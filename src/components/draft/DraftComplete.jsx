import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Trophy } from 'lucide-react';
import { C } from '../../lib/colors';
import { teamByCode } from '../../lib/teams';

export default function DraftComplete({ draft, poolId, isCommissioner, onFinalize, onReset }) {
  const [finalizing, setFinalizing] = useState(false);
  const [resetting,  setResetting]  = useState(false);
  const isFinalized = draft.status === 'finalized';

  // Group picks by member
  const teamsByMember = {};
  for (const pick of draft.picks) {
    if (!teamsByMember[pick.memberId]) teamsByMember[pick.memberId] = [];
    teamsByMember[pick.memberId].push(pick.teamCode);
  }

  async function handleFinalize() {
    setFinalizing(true);
    try {
      await onFinalize(draft.picks);
    } catch (err) {
      console.error('Finalize error:', err);
    } finally {
      setFinalizing(false);
    }
  }

  async function handleReset() {
    if (!confirm('Reset the entire draft? This cannot be undone.')) return;
    setResetting(true);
    try {
      await onReset();
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <Link to={`/p/${poolId}`}
        className="text-sm font-semibold no-underline mb-6 inline-flex items-center gap-1.5"
        style={{ color: C.muted }}>
        ← Back to pool
      </Link>

      <div className="text-center mb-10">
        <div className="text-5xl mb-3">🏆</div>
        <h1 className="font-display text-3xl mb-2" style={{ fontWeight: 800 }}>Draft Complete!</h1>
        <p className="text-sm" style={{ color: C.muted }}>
          {isFinalized
            ? 'Teams have been assigned. Head to the pool to track standings.'
            : 'Review the results below. Commissioner must finalize to save teams.'}
        </p>
      </div>

      {/* Results grid */}
      <div className="grid sm:grid-cols-2 gap-4 mb-8">
        {draft.members.map(m => {
          const teams = teamsByMember[m.id] || [];
          return (
            <div key={m.id} className="card-lg p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white"
                  style={{ background: m.color }}>
                  {m.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="font-semibold">{m.name}</div>
                  <div className="text-xs" style={{ color: C.muted }}>{teams.length} teams</div>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {teams.map(code => {
                  const t = teamByCode[code];
                  return (
                    <span key={code}
                      className="flex items-center gap-1 text-xs px-2 py-1 rounded-full"
                      style={{ background: C.bg, border: `1px solid ${C.border}` }}>
                      {t?.flag} {t?.name}
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Commissioner actions */}
      {isCommissioner && !isFinalized && (
        <div className="text-center space-y-3">
          <button onClick={handleFinalize} disabled={finalizing}
            className="px-8 py-3.5 rounded-xl font-display font-bold text-lg"
            style={{ background: C.green, color: 'white', opacity: finalizing ? 0.6 : 1 }}>
            {finalizing ? 'Finalizing…' : '✓ Finalize & Save Teams'}
          </button>
          <div className="text-xs" style={{ color: C.muted }}>
            This assigns teams to each member and activates the pool.
          </div>
          <div className="pt-1">
            <button onClick={handleReset} disabled={resetting}
              className="text-xs" style={{ color: C.muted }}>
              {resetting ? 'Resetting…' : 'Reset draft (start over)'}
            </button>
          </div>
        </div>
      )}

      {/* Non-commissioner waiting */}
      {!isCommissioner && !isFinalized && (
        <div className="card-lg p-6 text-center">
          <div className="text-3xl mb-2">⏳</div>
          <div className="font-semibold">Waiting for commissioner to finalize</div>
          <div className="text-sm mt-1" style={{ color: C.muted }}>
            Teams will be assigned once the commissioner confirms.
          </div>
        </div>
      )}

      {isFinalized && (
        <div className="text-center">
          <Link to={`/p/${poolId}`}
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl font-display font-bold text-lg no-underline"
            style={{ background: C.navy, color: 'white' }}>
            <Trophy size={18} /> Go to Pool
          </Link>
        </div>
      )}
    </div>
  );
}
