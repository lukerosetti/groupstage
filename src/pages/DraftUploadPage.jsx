import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Check, Upload, ArrowUpRight } from 'lucide-react';
import { C } from '../lib/colors';
import { TEAMS } from '../lib/teams';
import { doc, updateDoc, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { usePool } from '../hooks/usePool';
import useLocalUser from '../hooks/useLocalUser';

const CONF_COLORS = { UEFA: C.navy, CONMEBOL: C.red, CONCACAF: C.green, AFC: '#7C3AED', CAF: '#C97B14', OFC: C.muted };

export default function DraftUploadPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { pool, members } = usePool(id);
  const { user } = useLocalUser();
  const [selected, setSelected] = useState([]);
  const [confFilter, setConfFilter] = useState('All');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const confs = ['All', 'UEFA', 'CONMEBOL', 'CONCACAF', 'AFC', 'CAF', 'OFC'];
  const filtered = confFilter === 'All' ? TEAMS : TEAMS.filter(t => t.conf === confFilter);

  function toggleTeam(code) {
    setSelected(s => s.includes(code) ? s.filter(c => c !== code) : [...s, code]);
  }

  async function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const codes = JSON.parse(text);
      if (Array.isArray(codes)) setSelected(codes.filter(c => TEAMS.find(t => t.code === c)));
    } catch {
      setError('Invalid JSON file. Expected an array of team codes.');
    }
  }

  async function handleSubmit() {
    if (selected.length === 0) { setError('Pick at least one team.'); return; }
    setSaving(true);
    setError('');
    try {
      // Find member doc by email
      const membersQ = query(collection(db, 'pools', id, 'members'), where('email', '==', user.email));
      const snap = await getDocs(membersQ);
      if (snap.empty) throw new Error('Member not found');
      const memberDoc = snap.docs[0];
      await updateDoc(doc(db, 'pools', id, 'members', memberDoc.id), {
        teams: selected,
        draftedAt: serverTimestamp(),
      });
      navigate(`/p/${id}`);
    } catch (err) {
      setError(err.message || 'Failed to save. Try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="px-6 py-12 max-w-4xl mx-auto">
      <div className="mb-8">
        <div className="text-xs uppercase tracking-widest font-semibold mb-2" style={{ color: C.muted }}>
          {pool?.name || 'Your pool'} · Draft
        </div>
        <h2 className="font-display text-4xl" style={{ fontWeight: 700 }}>
          Pick your <span className="font-italic-serif" style={{ color: C.navy }}>teams.</span>
        </h2>
        <p className="mt-3 text-sm" style={{ color: C.muted }}>
          Select any teams you want to own. You'll earn points based on their tournament results.
        </p>
      </div>

      {/* Upload option */}
      <div className="card-lg p-5 mb-6 flex items-center gap-4">
        <Upload size={20} style={{ color: C.navy, flexShrink: 0 }} />
        <div className="flex-1">
          <div className="font-semibold text-sm">Have a JSON roster file?</div>
          <div className="text-xs mt-0.5" style={{ color: C.muted }}>Upload an array of team codes, e.g. ["BRA","ARG","FRA"]</div>
        </div>
        <label className="px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer"
          style={{ background: C.bg, border: `1px solid ${C.border}` }}>
          Choose file
          <input type="file" accept=".json" className="hidden" onChange={handleFileUpload} />
        </label>
      </div>

      {/* Selected summary */}
      {selected.length > 0 && (
        <div className="card-lg p-4 mb-6" style={{ borderColor: C.navy }}>
          <div className="text-xs uppercase tracking-widest font-semibold mb-2" style={{ color: C.navy }}>
            Selected ({selected.length})
          </div>
          <div className="flex flex-wrap gap-2">
            {selected.map(code => {
              const t = TEAMS.find(t => t.code === code);
              return (
                <button key={code} onClick={() => toggleTeam(code)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                  style={{ background: C.navy, color: 'white' }}>
                  {t?.flag} {t?.name} ×
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {confs.map(c => (
          <button key={c} onClick={() => setConfFilter(c)}
            className="px-3 py-1.5 rounded-full text-xs font-semibold"
            style={{
              background: confFilter === c ? C.ink : C.card,
              color: confFilter === c ? 'white' : C.ink,
              border: `1px solid ${confFilter === c ? C.ink : C.border}`,
            }}>
            {c}
          </button>
        ))}
      </div>

      {/* Team grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-8">
        {filtered.map(t => {
          const sel = selected.includes(t.code);
          return (
            <button key={t.code} onClick={() => toggleTeam(t.code)}
              className="text-left rounded-xl p-3 relative transition-all"
              style={{
                background: sel ? C.navy : C.card,
                border: `2px solid ${sel ? C.navy : C.border}`,
              }}>
              {sel && (
                <div className="absolute top-2 right-2 w-4 h-4 rounded-full flex items-center justify-center"
                  style={{ background: C.green }}>
                  <Check size={10} color="white" />
                </div>
              )}
              <div className="text-2xl mb-1">{t.flag}</div>
              <div className="font-semibold text-xs" style={{ color: sel ? 'white' : C.ink }}>{t.name}</div>
              <div className="text-[10px] mt-0.5 font-mono" style={{ color: sel ? 'rgba(255,255,255,0.6)' : C.muted }}>
                {t.conf} · #{t.rank}
              </div>
            </button>
          );
        })}
      </div>

      {error && <div className="mb-4 text-sm" style={{ color: C.red }}>{error}</div>}

      <div className="flex justify-end gap-3 pt-6 border-t" style={{ borderColor: C.border }}>
        <button onClick={handleSubmit} disabled={saving || selected.length === 0}
          className="px-6 py-3 rounded-lg font-semibold flex items-center gap-2"
          style={{ background: C.navy, color: 'white', opacity: (saving || selected.length === 0) ? 0.5 : 1 }}>
          {saving ? 'Saving…' : `Save ${selected.length} team${selected.length !== 1 ? 's' : ''} · View pool`}
          <ArrowUpRight size={16} />
        </button>
      </div>
    </div>
  );
}
