import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Upload, ArrowUpRight, FileSpreadsheet, FileJson, Check, Download, AlertTriangle } from 'lucide-react';
import { C } from '../lib/colors';
import { TEAMS, teamByCode } from '../lib/teams';
import { doc, updateDoc, serverTimestamp, collection, query, where, getDocs, writeBatch, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { usePool } from '../hooks/usePool';
import useLocalUser from '../hooks/useLocalUser';
import * as XLSX from 'xlsx';

// ── parsers ──────────────────────────────────────────────────────────────

// Common alternate names / spellings that differ from our canonical teams.js names
const ALIASES = {
  'TURKEY':             'TUR',
  'TURKIYE':            'TUR',
  'IVORY COAST':        'CIV',
  'COTE D\'IVOIRE':     'CIV',
  "COTE D'IVOIRE":      'CIV',
  'CÔTE D\'IVOIRE':     'CIV',
  'SOUTH KOREA':        'KOR',
  'KOREA':              'KOR',
  'REPUBLIC OF KOREA':  'KOR',
  'IRAN':               'IRN',
  'ISLAMIC REPUBLIC OF IRAN': 'IRN',
  'USA':                'USA',
  'UNITED STATES':      'USA',
  'US':                 'USA',
  'CZECHIA':            'CZE',
  'CZECH REPUBLIC':     'CZE',
  'BOSNIA':             'BIH',
  'BOSNIA AND HERZEGOVINA': 'BIH',
  'BOSNIA & HERZEGOVINA':   'BIH',
  'CURACAO':            'CUW',
  'DR CONGO':           'COD',
  'DRC':                'COD',
  'DEMOCRATIC REPUBLIC OF CONGO': 'COD',
  'CAPE VERDE':         'CPV',
  'NEW ZEALAND':        'NZL',
  'SAUDI ARABIA':       'KSA',
  'KSA':                'KSA',
};

function normaliseCode(raw) {
  if (!raw) return null;
  const s = String(raw).toUpperCase().trim().replace(/^["']|["']$/g, '');
  if (ALIASES[s]) return ALIASES[s];
  const byCode = TEAMS.find(t => t.code === s);
  if (byCode) return byCode.code;
  const byName = TEAMS.find(t => t.name.toUpperCase() === s);
  if (byName) return byName.code;
  return null;
}

// Keywords that identify the "who owns this team" column
const OWNER_KEYWORDS = ['draft', 'pick', 'owner', 'player', 'member', 'assign', 'person', 'by'];
// Keywords that identify the team column
const TEAM_KEYWORDS  = ['team', 'nation', 'country', 'club', 'name'];

function findColumns(headerCells) {
  const lower = headerCells.map(c => String(c || '').toLowerCase().trim());
  const teamCol  = lower.findIndex(c => TEAM_KEYWORDS.some(k => c.includes(k)));
  const ownerCol = lower.findIndex(c => OWNER_KEYWORDS.some(k => c.includes(k)));
  return { teamCol, ownerCol };
}

// Parse any spreadsheet format. Returns [{ teamCode, draftedBy }]
async function parseMasterFile(fileBuffer, filename) {
  const ext = filename.split('.').pop().toLowerCase();

  // ── JSON ────────────────────────────────────────────────────────────────
  if (ext === 'json') {
    const text = new TextDecoder().decode(fileBuffer);
    const data = JSON.parse(text);
    if (!Array.isArray(data)) throw new Error('JSON must be an array of objects: [{team:"BRA", draftedBy:"Luke Rosetti"}, ...]');
    return data.map(row => ({
      teamCode:  normaliseCode(row.team || row.code || row.Team || row.Code || ''),
      draftedBy: String(row.draftedBy || row.drafted_by || row.pickedBy || row.picked_by || row.player || row.owner || '').trim(),
    })).filter(r => r.teamCode);
  }

  // ── Excel / CSV via SheetJS ─────────────────────────────────────────────
  const wb      = XLSX.read(fileBuffer, { type: 'array' });
  const sheet   = wb.Sheets[wb.SheetNames[0]];
  const rows    = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  // Find the header row (scan first 25 rows)
  let headerIdx = -1;
  let teamCol   = -1;
  let ownerCol  = -1;

  for (let i = 0; i < Math.min(rows.length, 25); i++) {
    const { teamCol: t, ownerCol: o } = findColumns(rows[i]);
    if (t !== -1 && o !== -1) { headerIdx = i; teamCol = t; ownerCol = o; break; }
  }

  if (headerIdx === -1) throw new Error(
    "Couldn't find a 'Team' and 'Picked By' (or similar) column header in the first 25 rows. " +
    "Make sure your spreadsheet has column headers — or use our draft board template."
  );

  const results = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row  = rows[i];
    const code = normaliseCode(row[teamCol]);
    const who  = String(row[ownerCol] || '').trim();
    if (code && who) results.push({ teamCode: code, draftedBy: who });
  }

  if (results.length === 0) throw new Error(
    "Found the column headers but no assigned rows. Make sure the 'Picked By' column has names filled in."
  );

  return results;
}

// Parse a commissioner master file: expects rows with (team, drafted_by) or
// two-column CSV / the Draft Board sheet format.
// Returns: [{ teamCode, draftedBy }]
function parseMasterFileLegacy(text, filename) {
  const ext = filename.split('.').pop().toLowerCase();

  if (ext === 'json') {
    const data = JSON.parse(text);
    if (!Array.isArray(data)) throw new Error('JSON must be an array of objects: [{team:"BRA", draftedBy:"Luke Rosetti"}, ...]');
    return data.map(row => ({
      teamCode:  normaliseCode(row.team || row.code || row.Team || row.Code || ''),
      draftedBy: String(row.draftedBy || row.drafted_by || row.DraftedBy || row.player || '').trim(),
    })).filter(r => r.teamCode);
  }

  // CSV / TSV — look for a "DRAFTED BY" column header
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const delim = lines[0]?.includes('\t') ? '\t' : ',';

  let headerIdx = -1;
  let teamCol   = -1;
  let draftCol  = -1;

  for (let i = 0; i < Math.min(lines.length, 25); i++) {
    const cells = lines[i].split(delim).map(c => c.replace(/^["']|["']$/g, '').toLowerCase().trim());
    const { teamCol: t, ownerCol: o } = findColumns(cells);
    if (t !== -1 && o !== -1) { headerIdx = i; teamCol = t; draftCol = o; break; }
  }

  if (headerIdx === -1) {
    // Fallback: assume col 2 = team name, col 6 = drafted by (matches our Excel template)
    const results = [];
    for (const line of lines) {
      const cells = line.split(delim).map(c => c.replace(/^["']|["']$/g, '').trim());
      if (cells.length < 3) continue;
      const code = normaliseCode(cells[2] || cells[1] || '');
      const who  = (cells[6] || cells[5] || '').trim();
      if (code && who) results.push({ teamCode: code, draftedBy: who });
    }
    if (results.length === 0) throw new Error("Couldn't detect columns. Make sure the file has a 'Team Name' and 'DRAFTED BY' column, or use our template.");
    return results;
  }

  const results = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const cells = lines[i].split(delim).map(c => c.replace(/^["']|["']$/g, '').trim());
    const code  = normaliseCode(cells[teamCol] || '');
    const who   = (cells[draftCol] || '').trim();
    if (code && who) results.push({ teamCode: code, draftedBy: who });
  }
  return results;
}

// Fuzzy name match: case-insensitive, trims whitespace
function matchMember(draftedBy, members) {
  const needle = draftedBy.toLowerCase().trim();
  return members.find(m => m.name.toLowerCase().trim() === needle) || null;
}

// ── component ─────────────────────────────────────────────────────────────

export default function DraftUploadPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { pool, members } = usePool(id);
  const { user } = useLocalUser();

  const [filename, setFilename]     = useState('');
  const [mapping, setMapping]       = useState(null);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);

  const commEmail = pool?.commissionerEmail || pool?.creatorEmail;
  const isCommissioner = user?.email && commEmail && user.email === commEmail;
  const teamsAlreadyAssigned = members.some(m => (m.teams || []).length > 0);

  async function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setError('');
    setMapping(null);
    setFilename(file.name);
    try {
      const buffer = await file.arrayBuffer();
      const rows = await parseMasterFile(new Uint8Array(buffer), file.name);
      if (rows.length === 0) throw new Error('No team assignments found. Check the file format matches the template.');
      const mapped = rows.map(r => ({
        ...r,
        member: matchMember(r.draftedBy, members),
      }));
      setMapping(mapped);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleCommit() {
    const valid = mapping.filter(r => r.member && r.teamCode);
    if (valid.length === 0) { setError('No valid assignments to save.'); return; }

    // Group teams by member id
    const byMember = {};
    for (const r of valid) {
      if (!byMember[r.member.id]) byMember[r.member.id] = [];
      byMember[r.member.id].push(r.teamCode);
    }

    // Check team uniqueness
    const allCodes = valid.map(r => r.teamCode);
    const dupes = allCodes.filter((c, i) => allCodes.indexOf(c) !== i);
    if (dupes.length > 0) {
      const names = [...new Set(dupes)].map(c => teamByCode[c]?.name).join(', ');
      setError(`Duplicate team assignments found: ${names}. Each team can only appear once.`);
      return;
    }

    setSaving(true);
    setError('');
    try {
      const batch = writeBatch(db);
      for (const [memberId, teams] of Object.entries(byMember)) {
        batch.update(doc(db, 'pools', id, 'members', memberId), {
          teams,
          draftedAt: serverTimestamp(),
        });
      }
      // Mark pool as active
      batch.update(doc(db, 'pools', id), { status: 'active' });
      await batch.commit();
      navigate(`/p/${id}`);
    } catch (err) {
      setError(err.message || 'Failed to save. Try again.');
    } finally {
      setSaving(false);
    }
  }

  const unmatchedNames  = mapping ? [...new Set(mapping.filter(r => !r.member).map(r => r.draftedBy))] : [];
  const unknownTeams    = mapping ? mapping.filter(r => !r.teamCode) : [];
  const validRows       = mapping ? mapping.filter(r => r.member && r.teamCode) : [];
  const memberSummary   = validRows.reduce((acc, r) => {
    const key = r.member.id;
    acc[key] = acc[key] || { member: r.member, teams: [] };
    acc[key].teams.push(r.teamCode);
    return acc;
  }, {});

  // Non-commissioner block
  if (pool && !isCommissioner) {
    return (
      <div className="px-6 py-20 max-w-md mx-auto text-center">
        <div className="text-4xl mb-4">🔒</div>
        <h2 className="font-display text-2xl mb-2" style={{ fontWeight: 700 }}>Commissioner only</h2>
        <p className="text-sm" style={{ color: C.muted }}>
          Only the pool commissioner can upload draft results.
        </p>
      </div>
    );
  }

  return (
    <div className="px-6 py-12 max-w-2xl mx-auto">
      <div className="mb-8">
        <div className="text-xs uppercase tracking-widest font-semibold mb-2" style={{ color: C.muted }}>
          {pool?.name || 'Your pool'} · Commissioner upload
        </div>
        <h2 className="font-display text-4xl" style={{ fontWeight: 700 }}>
          Upload the <span className="font-italic-serif" style={{ color: C.navy }}>draft results.</span>
        </h2>
        <p className="mt-3 text-sm" style={{ color: C.muted }}>
          Upload the completed Draft Board spreadsheet. The app reads the <strong>DRAFTED BY</strong> column and assigns teams to each member automatically.
        </p>
      </div>

      {/* Download template */}
      <a href="/groupstage-draft-board.xlsx" download
        className="card-lg p-5 mb-6 flex items-center gap-4 no-underline block"
        style={{ borderColor: C.navy, borderWidth: 2 }}>
        <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: 'rgba(30,58,111,0.1)' }}>
          <Download size={20} style={{ color: C.navy }} />
        </div>
        <div className="flex-1">
          <div className="font-semibold text-sm" style={{ color: C.navy }}>Download the commissioner template</div>
          <div className="text-xs mt-0.5" style={{ color: C.muted }}>
            Includes all 48 teams, a DRAFTED BY column, and instructions. Fill it in during your live draft call, then upload it here.
          </div>
        </div>
        <span className="text-xs font-bold px-3 py-1.5 rounded-lg" style={{ background: C.navy, color: 'white' }}>
          .xlsx
        </span>
      </a>

      {/* Format hint */}
      <div className="card-lg p-5 mb-6">
        <div className="text-xs uppercase tracking-widest font-semibold mb-3" style={{ color: C.muted }}>Accepted formats</div>
        <div className="space-y-3">
          <FormatRow icon={<FileSpreadsheet size={15} style={{ color: C.green }} />}
            label="Completed Draft Board template (.xlsx exported as .csv)"
            note="Use our template above — the app knows its column layout" />
          <FormatRow icon={<FileSpreadsheet size={15} style={{ color: C.green }} />}
            label="Any CSV with 'Team Name' and 'Drafted By' columns"
            note="Column headers are detected automatically — case-insensitive" />
          <FormatRow icon={<FileJson size={15} style={{ color: C.navy }} />}
            label='JSON array: [{"team":"BRA","draftedBy":"Luke Rosetti"}, ...]'
            note="team field accepts 3-letter codes or full names" />
        </div>
      </div>

      {/* Overwrite warning */}
      {teamsAlreadyAssigned && !confirmOverwrite && (
        <div className="card-lg p-5 mb-6" style={{ borderColor: C.gold, borderWidth: 2 }}>
          <div className="font-semibold text-sm mb-1" style={{ color: C.ink }}>⚠️ Teams are already assigned</div>
          <p className="text-xs mb-3" style={{ color: C.muted }}>
            Uploading a new file will overwrite all current team assignments. This cannot be undone.
          </p>
          <button onClick={() => setConfirmOverwrite(true)}
            className="px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ background: C.red, color: 'white' }}>
            Yes, overwrite assignments
          </button>
        </div>
      )}

      {/* Drop zone */}
      <label className="card-lg p-10 mb-6 flex flex-col items-center gap-3 cursor-pointer text-center"
        style={{ borderStyle: 'dashed', borderWidth: 2, borderColor: mapping ? C.navy : C.border,
                 pointerEvents: teamsAlreadyAssigned && !confirmOverwrite ? 'none' : 'auto',
                 opacity: teamsAlreadyAssigned && !confirmOverwrite ? 0.4 : 1 }}>
        <div className="w-12 h-12 rounded-xl flex items-center justify-center"
          style={{ background: 'rgba(30,58,111,0.08)' }}>
          <Upload size={22} style={{ color: C.navy }} />
        </div>
        {filename ? (
          <div>
            <div className="font-semibold">{filename}</div>
            <div className="text-xs mt-1" style={{ color: C.muted }}>Click to replace</div>
          </div>
        ) : (
          <div>
            <div className="font-semibold">Click to upload the completed draft board</div>
            <div className="text-xs mt-1" style={{ color: C.muted }}>CSV (from Excel) or JSON</div>
          </div>
        )}
        <input type="file" accept=".csv,.json,.txt,.xls,.xlsx" className="hidden" onChange={handleFile} />
      </label>

      {/* Mapping results */}
      {mapping && (
        <div className="space-y-4 mb-6">

          {/* Valid assignments by member */}
          {Object.values(memberSummary).length > 0 && (
            <div className="card-lg p-5">
              <div className="text-xs uppercase tracking-widest font-semibold mb-3" style={{ color: C.green }}>
                ✓ {validRows.length} assignment{validRows.length !== 1 ? 's' : ''} ready · {Object.keys(memberSummary).length} member{Object.keys(memberSummary).length !== 1 ? 's' : ''}
              </div>
              <div className="space-y-3">
                {Object.values(memberSummary).map(({ member, teams }) => (
                  <div key={member.id} className="flex items-start gap-3 p-3 rounded-lg" style={{ background: C.bg }}>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                      style={{ background: member.color }}>
                      {member.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-sm">{member.name}</div>
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {teams.map(code => {
                          const t = teamByCode[code];
                          return (
                            <span key={code} className="text-xs px-2 py-0.5 rounded-full font-semibold"
                              style={{ background: C.navy, color: 'white' }}>
                              {t?.flag} {t?.name}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                    <div className="text-xs font-mono font-bold shrink-0" style={{ color: C.navy }}>
                      {teams.length} teams
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Unmatched names warning */}
          {unmatchedNames.length > 0 && (
            <div className="card-lg p-5" style={{ borderColor: C.red, borderWidth: 2 }}>
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle size={16} style={{ color: C.red }} />
                <div className="text-xs uppercase tracking-widest font-semibold" style={{ color: C.red }}>
                  {unmatchedNames.length} name{unmatchedNames.length !== 1 ? 's' : ''} didn't match any pool member
                </div>
              </div>
              <div className="space-y-2 mb-3">
                {unmatchedNames.map(name => (
                  <div key={name} className="flex items-center justify-between p-2.5 rounded-lg"
                    style={{ background: RED_LIGHT }}>
                    <span className="text-sm font-semibold" style={{ color: C.red }}>"{name}"</span>
                    <span className="text-xs" style={{ color: C.muted }}>not found in pool</span>
                  </div>
                ))}
              </div>
              <div className="text-xs p-3 rounded-lg" style={{ background: '#FFF5F5', color: '#5A0000' }}>
                <strong>Fix:</strong> The name in the DRAFTED BY column must exactly match how the member registered.
                Check the Pool Members Reference sheet in the template, or ask them to confirm their display name.
                Teams assigned to unmatched names will be skipped.
              </div>
            </div>
          )}
        </div>
      )}

      {error && <div className="mb-4 text-sm" style={{ color: C.red }}>{error}</div>}

      <div className="flex justify-end gap-3 pt-6 border-t" style={{ borderColor: C.border }}>
        <button onClick={handleCommit} disabled={saving || !validRows.length}
          className="px-6 py-3 rounded-lg font-semibold flex items-center gap-2"
          style={{ background: C.navy, color: 'white', opacity: (saving || !validRows.length) ? 0.5 : 1 }}>
          {saving
            ? 'Saving…'
            : `Assign ${validRows.length} team${validRows.length !== 1 ? 's' : ''} to ${Object.keys(memberSummary).length} member${Object.keys(memberSummary).length !== 1 ? 's' : ''}`}
          <ArrowUpRight size={16} />
        </button>
      </div>
    </div>
  );
}

const RED_LIGHT = "#FFF5F5";

function FormatRow({ icon, label, note }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div>
        <div className="text-sm font-semibold">{label}</div>
        <div className="text-xs mt-0.5" style={{ color: C.muted }}>{note}</div>
      </div>
    </div>
  );
}
