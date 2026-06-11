import { Copy, Check, Edit2, X, Save, Mail } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { C } from '../../lib/colors';
import { TEAMS, teamByCode } from '../../lib/teams';
import { calcMemberPoints } from '../../lib/scoring';
import { isToday } from 'date-fns';
import { doc, writeBatch, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import useLocalUser from '../../hooks/useLocalUser';

export default function OverviewTab({ pool, members, matches, poolId, inviteUrl }) {
  const { user } = useLocalUser();
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState('');
  // editAssignments: { [memberId]: string[] }
  const [editAssignments, setEditAssignments] = useState({});

  const standings = members
    .map(m => ({ ...m, ...calcMemberPoints(m.teams || [], matches) }))
    .sort((a, b) => b.total - a.total);

  const allOwnedCodes = new Set(members.flatMap(m => m.teams || []));
  const todayMatches = matches.filter(m => {
    if (!m.kickoff) return false;
    const d = m.kickoff?.toDate ? m.kickoff.toDate() : new Date(m.kickoff);
    return isToday(d) && (allOwnedCodes.has(m.homeTeam) || allOwnedCodes.has(m.awayTeam));
  });

  const allJoined = members.length > 0 && members.every(m => m.status === 'joined');
  const teamsAssigned = members.some(m => (m.teams || []).length > 0);

  // Commissioner check: by pool.commissionerEmail or role === 'owner' fallback
  const commEmail = pool?.commissionerEmail || pool?.creatorEmail;
  const isCommissioner = user?.email && commEmail && user.email === commEmail;

  function enterEditMode() {
    const init = {};
    for (const m of members) init[m.id] = [...(m.teams || [])];
    setEditAssignments(init);
    setEditError('');
    setEditMode(true);
  }

  function cancelEdit() {
    setEditMode(false);
    setEditAssignments({});
    setEditError('');
  }

  function moveTeam(teamCode, fromMemberId, toMemberId) {
    setEditAssignments(prev => {
      const next = { ...prev };
      next[fromMemberId] = next[fromMemberId].filter(c => c !== teamCode);
      next[toMemberId] = [...(next[toMemberId] || []), teamCode];
      return next;
    });
  }

  function removeTeam(teamCode, memberId) {
    setEditAssignments(prev => ({
      ...prev,
      [memberId]: prev[memberId].filter(c => c !== teamCode),
    }));
  }

  function addTeamToMember(teamCode, memberId) {
    setEditAssignments(prev => ({
      ...prev,
      [memberId]: [...(prev[memberId] || []), teamCode],
    }));
  }

  async function saveEdits() {
    // Check for duplicates
    const all = Object.values(editAssignments).flat();
    const dupes = all.filter((c, i) => all.indexOf(c) !== i);
    if (dupes.length > 0) {
      const names = [...new Set(dupes)].map(c => teamByCode[c]?.name).join(', ');
      setEditError(`Duplicate teams: ${names}. Each team can only belong to one member.`);
      return;
    }
    setSaving(true);
    setEditError('');
    try {
      const batch = writeBatch(db);
      for (const [memberId, teams] of Object.entries(editAssignments)) {
        batch.update(doc(db, 'pools', poolId, 'members', memberId), {
          teams,
          draftedAt: serverTimestamp(),
        });
      }
      await batch.commit();
      setEditMode(false);
    } catch (err) {
      setEditError('Failed to save. Try again.');
    } finally {
      setSaving(false);
    }
  }

  // All assigned teams across current edit state
  const assignedInEdit = new Set(Object.values(editAssignments).flat());
  const unassigned = TEAMS.filter(t => !assignedInEdit.has(t.code));

  return (
    <div className="space-y-6">
      {/* Member cards */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-xl" style={{ fontWeight: 700 }}>Members</h3>
          {isCommissioner && teamsAssigned && !editMode && (
            <button onClick={enterEditMode}
              className="flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-lg"
              style={{ background: 'rgba(30,58,111,0.08)', color: C.navy }}>
              <Edit2 size={13} /> Edit assignments
            </button>
          )}
          {editMode && (
            <div className="flex items-center gap-2">
              <button onClick={cancelEdit} className="text-sm px-3 py-2 rounded-lg font-semibold"
                style={{ color: C.muted, background: C.bg }}>
                Cancel
              </button>
              <button onClick={saveEdits} disabled={saving}
                className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-lg"
                style={{ background: C.navy, color: 'white', opacity: saving ? 0.6 : 1 }}>
                <Save size={13} /> {saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          )}
        </div>

        {editMode ? (
          <EditAssignmentsPanel
            members={members}
            editAssignments={editAssignments}
            unassigned={unassigned}
            onRemove={removeTeam}
            onAdd={addTeamToMember}
            editError={editError}
          />
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {members.map(m => <MemberCard key={m.id} member={m} />)}
            {Array.from({ length: Math.max(0, pool.memberCount - members.length) }).map((_, i) => (
              <EmptySlot key={i} />
            ))}
          </div>
        )}
      </div>

      {/* Commissioner: manage member emails */}
      {isCommissioner && !editMode && (
        <MemberEmailPanel members={members} poolId={poolId} />
      )}

      {/* Standings preview */}
      {!editMode && standings.length > 0 && (
        <div>
          <h3 className="font-display text-xl mb-4" style={{ fontWeight: 700 }}>Standings</h3>
          <div className="card-lg p-6">
            <div className="space-y-2">
              {standings.slice(0, 3).map((m, i) => (
                <div key={m.id} className="flex items-center gap-4 p-3 rounded-lg"
                  style={{ background: i === 0 ? 'rgba(201,161,74,0.08)' : 'transparent' }}>
                  <div className="font-display text-2xl w-8" style={{ fontWeight: 800, color: i === 0 ? C.gold : C.muted }}>
                    {i + 1}
                  </div>
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white"
                    style={{ background: m.color }}>
                    {m.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-sm">{m.name}</div>
                    <div className="text-lg">{(m.teams || []).map(c => teamByCode[c]?.flag).join('')}</div>
                  </div>
                  <div className="font-display text-2xl" style={{ fontWeight: 800 }}>{m.total}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Today's matches */}
      {!editMode && todayMatches.length > 0 && (
        <div>
          <h3 className="font-display text-xl mb-4" style={{ fontWeight: 700 }}>Your teams today</h3>
          <div className="grid sm:grid-cols-2 gap-3">
            {todayMatches.map(m => (
              <TodayMatchCard key={m.id} match={m} members={members} />
            ))}
          </div>
        </div>
      )}

      {/* Draft room CTA — show when no teams assigned yet */}
      {!editMode && !teamsAssigned && (
        <div>
          <h3 className="font-display text-xl mb-4" style={{ fontWeight: 700 }}>Draft</h3>
          <div className="card-lg p-6">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <div className="font-semibold mb-1">Ready to draft teams?</div>
                <div className="text-sm" style={{ color: C.muted }}>
                  {isCommissioner
                    ? 'Open the live draft room — members join and pick in real-time snake order.'
                    : 'The commissioner will open the draft room when everyone is ready.'}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Link to={`/p/${poolId}/room`}
                  className="px-5 py-2.5 rounded-lg text-sm font-semibold no-underline flex items-center gap-1.5"
                  style={{ background: C.navy, color: 'white' }}>
                  ⚡ {isCommissioner ? 'Open Draft Room' : 'Join Draft Room'}
                </Link>
                {isCommissioner && (
                  <Link to={`/p/${poolId}/draft`}
                    className="px-4 py-2.5 rounded-lg text-sm font-semibold no-underline"
                    style={{ background: C.bg, color: C.muted, border: `1px solid ${C.border}` }}>
                    Upload CSV instead
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Invite section — only show when not everyone has joined */}
      {!allJoined && !editMode && (
        <div>
          <h3 className="font-display text-xl mb-4" style={{ fontWeight: 700 }}>Invite friends</h3>
          <div className="card-lg p-6">
            <div className="text-xs uppercase tracking-widest font-semibold mb-3" style={{ color: C.muted }}>Pool invite link</div>
            <div className="rounded-lg px-3 py-2 mb-3 font-mono text-xs truncate"
              style={{ background: C.bg, color: C.muted, border: `1px solid ${C.border}` }}>
              {`${window.location.origin}/p/${poolId}/join?pool=${encodeURIComponent(pool.name)}`}
            </div>
            <CopyButton url={`${window.location.origin}/p/${poolId}/join?pool=${encodeURIComponent(pool.name)}`} />
            <div className="text-xs mt-3" style={{ color: C.muted }}>
              Share this one link with everyone. Each person enters their email to claim their spot — and it's how they get back in on any device.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MemberEmailPanel({ members, poolId }) {
  const [emails, setEmails]   = useState({});   // { memberId: draftValue }
  const [saving, setSaving]   = useState(null);  // memberId being saved
  const [saved,  setSaved]    = useState(null);  // memberId just saved
  const [open,   setOpen]     = useState(false);

  const missingCount = members.filter(m => !m.email).length;
  if (missingCount === 0 && !open) return null;

  const poolEnc = encodeURIComponent(pool.name);
  const roomUrl = () => `${window.location.origin}/p/${poolId}/join?pool=${poolEnc}`;

  async function saveEmail(member) {
    const val = (emails[member.id] ?? member.email ?? '').trim().toLowerCase();
    if (!val) return;
    setSaving(member.id);
    try {
      await updateDoc(doc(db, 'pools', poolId, 'members', member.id), { email: val });
      setSaved(member.id);
      setTimeout(() => setSaved(null), 2000);
    } catch { /* ignore */ } finally {
      setSaving(null);
    }
  }

  return (
    <div>
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 text-sm font-semibold mb-3"
        style={{ color: missingCount > 0 ? C.gold : C.muted }}>
        <Mail size={14} />
        {open ? 'Hide member emails' : `Member emails${missingCount > 0 ? ` · ${missingCount} missing` : ''}`}
      </button>

      {open && (
        <div className="card-lg p-5 space-y-3">
          <div className="text-xs" style={{ color: C.muted }}>
            Add an email for each member so they can identify themselves when joining.
          </div>
          {members.map(m => {
            const draft   = emails[m.id] ?? m.email ?? '';
            const link    = roomUrl();
            const hasEmail = !!m.email;
            return (
              <div key={m.id} className="flex items-center gap-3 flex-wrap">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                  style={{ background: m.color }}>
                  {m.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div className="font-semibold text-sm w-24 truncate shrink-0">{m.name}</div>
                <input
                  type="email"
                  value={draft}
                  onChange={e => setEmails(prev => ({ ...prev, [m.id]: e.target.value }))}
                  placeholder="email@example.com"
                  className="flex-1 min-w-0 px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ background: C.bg, border: `1px solid ${C.border}` }}
                />
                <button
                  onClick={() => saveEmail(m)}
                  disabled={saving === m.id || draft === m.email}
                  className="shrink-0 px-3 py-2 rounded-lg text-xs font-semibold"
                  style={{
                    background: saved === m.id ? C.green : C.navy,
                    color: 'white',
                    opacity: (saving === m.id || draft === m.email) ? 0.5 : 1,
                  }}>
                  {saved === m.id ? '✓ Saved' : saving === m.id ? '…' : 'Save'}
                </button>
                {hasEmail && (
                  <CopyInviteLink url={link} />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CopyInviteLink({ url }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }
  return (
    <button onClick={copy} className="shrink-0 flex items-center gap-1 text-xs font-semibold px-3 py-2 rounded-lg"
      style={{ background: copied ? C.green : C.bg, color: copied ? 'white' : C.muted, border: `1px solid ${C.border}` }}>
      {copied ? <Check size={11} /> : <Copy size={11} />}
      {copied ? 'Copied' : 'Link'}
    </button>
  );
}

function EditAssignmentsPanel({ members, editAssignments, unassigned, onRemove, onAdd, editError }) {
  const [selectedTeam, setSelectedTeam] = useState('');
  const [targetMember, setTargetMember] = useState('');

  function handleAdd(e) {
    e.preventDefault();
    if (!selectedTeam || !targetMember) return;
    onAdd(selectedTeam, targetMember);
    setSelectedTeam('');
  }

  return (
    <div className="space-y-4">
      {editError && (
        <div className="text-sm p-3 rounded-lg" style={{ background: 'rgba(200,37,44,0.08)', color: C.red }}>
          {editError}
        </div>
      )}

      {/* Per-member team lists */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {members.map(m => {
          const teams = editAssignments[m.id] || [];
          return (
            <div key={m.id} className="card-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                  style={{ background: m.color }}>
                  {m.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div className="font-semibold text-sm truncate">{m.name}</div>
                <span className="ml-auto text-xs font-mono" style={{ color: C.muted }}>{teams.length}</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {teams.map(code => {
                  const t = teamByCode[code];
                  return (
                    <button key={code} type="button" onClick={() => onRemove(code, m.id)}
                      title={`Remove ${t?.name}`}
                      className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-semibold group"
                      style={{ background: C.navy, color: 'white' }}>
                      {t?.flag} {t?.name}
                      <X size={9} className="opacity-60 group-hover:opacity-100" />
                    </button>
                  );
                })}
                {teams.length === 0 && (
                  <span className="text-xs italic" style={{ color: C.muted }}>No teams</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add a team */}
      <div className="card-lg p-5">
        <div className="text-xs uppercase tracking-widest font-semibold mb-3" style={{ color: C.muted }}>
          Add unassigned team
        </div>
        <form onSubmit={handleAdd} className="flex gap-2 flex-wrap">
          <select value={selectedTeam} onChange={e => setSelectedTeam(e.target.value)}
            className="flex-1 p-2.5 rounded-lg text-sm outline-none"
            style={{ background: C.bg, border: `1px solid ${C.border}`, minWidth: 160 }}>
            <option value="">Select team…</option>
            {unassigned.map(t => (
              <option key={t.code} value={t.code}>{t.flag} {t.name}</option>
            ))}
          </select>
          <select value={targetMember} onChange={e => setTargetMember(e.target.value)}
            className="flex-1 p-2.5 rounded-lg text-sm outline-none"
            style={{ background: C.bg, border: `1px solid ${C.border}`, minWidth: 160 }}>
            <option value="">Select member…</option>
            {members.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
          <button type="submit" disabled={!selectedTeam || !targetMember}
            className="px-4 py-2.5 rounded-lg text-sm font-semibold"
            style={{ background: C.navy, color: 'white', opacity: (!selectedTeam || !targetMember) ? 0.4 : 1 }}>
            Add
          </button>
        </form>
        {unassigned.length === 0 && (
          <div className="text-xs mt-2" style={{ color: C.green }}>All 48 teams are assigned.</div>
        )}
      </div>

      <div className="text-xs p-3 rounded-lg" style={{ background: 'rgba(201,161,74,0.08)', color: C.muted }}>
        Click any team badge to remove it. Use the form below to add unassigned teams.
        Changes take effect when you click <strong style={{ color: C.ink }}>Save changes</strong>.
      </div>
    </div>
  );
}

function MemberCard({ member }) {
  const flags = (member.teams || []).map(c => teamByCode[c]?.flag).filter(Boolean);
  const initials = member.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div className="card-lg p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white"
          style={{ background: member.color }}>
          {initials}
        </div>
        <div>
          <div className="font-semibold">{member.name}</div>
          <div className="text-xs" style={{ color: member.teams?.length ? C.green : C.muted }}>
            {member.teams?.length ? `${member.teams.length} teams picked` : 'Pending…'}
          </div>
        </div>
      </div>
      {flags.length > 0 && (
        <div className="text-xl leading-relaxed">{flags.join(' ')}</div>
      )}
    </div>
  );
}

function EmptySlot() {
  return (
    <div className="card-lg p-5 flex items-center gap-3" style={{ borderStyle: 'dashed', opacity: 0.5 }}>
      <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: C.bg }}>
        <span style={{ color: C.muted }}>?</span>
      </div>
      <div className="text-sm" style={{ color: C.muted }}>Waiting for member…</div>
    </div>
  );
}

function TodayMatchCard({ match, members }) {
  const home = teamByCode[match.homeTeam];
  const away = teamByCode[match.awayTeam];
  const owners = members.filter(m => m.teams?.includes(match.homeTeam) || m.teams?.includes(match.awayTeam));
  return (
    <div className="card-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs uppercase tracking-widest font-semibold" style={{ color: match.status === 'live' ? C.red : C.muted }}>
          {match.status === 'live' ? '● LIVE' : match.status === 'completed' ? 'FT' : 'Today'}
        </div>
        <div className="text-xs font-mono" style={{ color: C.muted }}>{match.round?.toUpperCase()}</div>
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <span className="text-xl">{home?.flag}</span> {home?.name}
        </div>
        {match.score ? (
          <div className="font-display text-xl font-bold">{match.score.home} – {match.score.away}</div>
        ) : (
          <div className="text-xs font-mono" style={{ color: C.muted }}>vs</div>
        )}
        <div className="flex items-center gap-2 text-sm font-semibold">
          {away?.name} <span className="text-xl">{away?.flag}</span>
        </div>
      </div>
      {owners.length > 0 && (
        <div className="mt-2 flex gap-1">
          {owners.map(o => (
            <div key={o.id} className="text-[10px] px-2 py-0.5 rounded-full font-semibold text-white"
              style={{ background: o.color }}>
              {o.name.split(' ')[0]}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CopyButton({ url }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }
  return (
    <button onClick={copy} className="px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shrink-0"
      style={{ background: copied ? C.green : C.navy, color: 'white' }}>
      {copied ? <Check size={11} /> : <Copy size={11} />}
      {copied ? 'Copied!' : 'Copy link'}
    </button>
  );
}
