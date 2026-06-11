import { useState, useEffect } from 'react';
import { C } from '../../lib/colors';
import { TEAMS, teamByCode } from '../../lib/teams';

const CONFS = ['All', 'UEFA', 'CONMEBOL', 'CONCACAF', 'AFC', 'CAF', 'OFC'];

export default function DraftBoard({
  draft, pool, myMember, isCommissioner,
  onPick, onAutoAdvance, onPresence,
}) {
  const [confFilter, setConfFilter] = useState('All');
  const [search,     setSearch]     = useState('');
  const [picking,    setPicking]    = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  // Set when the server rejects a pick (team taken or not your turn)
  const [pickError,   setPickError]   = useState('');

  const currentPickerId = draft.order[draft.currentPickIndex];
  const currentMember   = draft.members.find(m => m.id === currentPickerId);
  const isMyTurn        = currentPickerId === myMember?.id;
  // Commissioner can pick for anyone
  const canPick         = isMyTurn || isCommissioner;

  // Presence heartbeat
  useEffect(() => {
    if (!myMember?.id) return;
    onPresence(myMember.id);
    const id = setInterval(() => onPresence(myMember.id), 15000);
    return () => clearInterval(id);
  }, [myMember?.id]);

  // Auto-advance when timer expires (client-side, transaction-guarded)
  useEffect(() => {
    if (draft.status !== 'picking' || !draft.pickDeadline) return;
    const interval = setInterval(() => {
      const deadline = draft.pickDeadline?.toDate
        ? draft.pickDeadline.toDate()
        : new Date(draft.pickDeadline);
      if (new Date() > deadline) {
        onAutoAdvance(draft.currentPickIndex);
      }
    }, 800);
    return () => clearInterval(interval);
  }, [draft.currentPickIndex, draft.pickDeadline]);

  async function handlePick(teamCode) {
    if (!canPick || picking) return;
    setPicking(true);
    setPickError('');
    try {
      // Commissioner picks on behalf of whoever's turn it is
      const pickAs = isMyTurn ? myMember.id : currentPickerId;
      await onPick(teamCode, pickAs);
    } catch (err) {
      // The Firestore transaction throws a descriptive message when the team
      // was claimed by another client in the same instant — surface it.
      const msg = err?.message || '';
      if (msg.includes('not available') || msg.includes('taken')) {
        setPickError('That team was just taken — pick another!');
      } else if (msg.includes('Not your turn')) {
        setPickError("It's no longer your turn.");
      } else {
        setPickError('Pick failed — try again.');
      }
      // Auto-dismiss after 4 seconds
      setTimeout(() => setPickError(''), 4000);
    } finally {
      setPicking(false);
    }
  }

  const availableSet   = new Set(draft.availableTeams);
  const filteredTeams  = TEAMS.filter(t => {
    if (!availableSet.has(t.code)) return false;
    if (confFilter !== 'All' && t.conf !== confFilter) return false;
    if (search && !t.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const round       = Math.floor(draft.currentPickIndex / draft.members.length);
  const isEvenRound = round % 2 === 0;
  const pickNum     = draft.currentPickIndex + 1;

  return (
    <div style={{ minHeight: '100vh', background: isMyTurn ? `${myMember?.color}06` : undefined }}>
      {/* Sticky top bar */}
      <div className="sticky top-0 z-30 border-b"
        style={{ background: 'rgba(246,242,233,0.96)', backdropFilter: 'blur(10px)', borderColor: C.border }}>
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          {/* Current picker info */}
          <div className="flex-1 min-w-0">
            {isMyTurn ? (
              <div className="flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full" style={{ background: C.green, animation: 'pulse-dot 1.2s infinite' }} />
                <span className="font-display font-bold text-lg" style={{ color: C.green }}>Your pick!</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                  style={{ background: currentMember?.color }}>
                  {currentMember?.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <span className="font-semibold text-sm truncate">
                  {currentMember?.name} is picking…
                </span>
              </div>
            )}
            <div className="text-[10px] mt-0.5 font-mono" style={{ color: C.muted }}>
              Pick {pickNum}/{draft.totalPicks} · Round {round + 1} · {isEvenRound ? '→' : '←'}
            </div>
          </div>

          <PickTimer deadline={draft.pickDeadline} timerSec={draft.timerSec} />

          <button onClick={() => setShowHistory(h => !h)}
            className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg"
            style={{ background: C.card, border: `1px solid ${C.border}` }}>
            {showHistory ? 'Hide' : 'History'}
          </button>
        </div>

        {/* Progress bar */}
        <div className="h-1" style={{ background: C.border }}>
          <div className="h-full transition-all duration-500"
            style={{ background: C.navy, width: `${(draft.currentPickIndex / draft.totalPicks) * 100}%` }} />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 flex gap-6">
        {/* Main pick area */}
        <div className="flex-1 min-w-0">

          {/* "Your turn" banner */}
          {isMyTurn && (
            <div className="rounded-xl p-4 mb-5 flex items-center gap-3"
              style={{ background: `${myMember?.color}18`, border: `2px solid ${myMember?.color}` }}>
              <span className="text-2xl">⚡</span>
              <div>
                <div className="font-display font-bold text-base">It's your pick!</div>
                <div className="text-sm" style={{ color: C.muted }}>Tap any team below to draft them.</div>
              </div>
            </div>
          )}
          {/* Commissioner acting on behalf of another member */}
          {!isMyTurn && isCommissioner && (
            <div className="rounded-xl p-4 mb-5 flex items-center gap-3"
              style={{ background: `${currentMember?.color}12`, border: `2px dashed ${currentMember?.color}` }}>
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                style={{ background: currentMember?.color }}>
                {currentMember?.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="font-display font-bold text-base">
                  Picking for {currentMember?.name}
                </div>
                <div className="text-sm" style={{ color: C.muted }}>
                  Commissioner override — select a team on their behalf.
                </div>
              </div>
            </div>
          )}

          {/* Race-condition error: team was claimed by another picker simultaneously */}
          {pickError && (
            <div className="rounded-xl px-4 py-3 mb-4 flex items-center gap-2 text-sm font-semibold"
              style={{ background: 'rgba(220,38,38,0.08)', border: '1.5px solid rgba(220,38,38,0.35)', color: '#dc2626' }}>
              <span>⚡</span>
              {pickError}
            </div>
          )}

          {/* Filters */}
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search…"
              className="px-3 py-2 rounded-lg text-sm outline-none"
              style={{ background: C.card, border: `1px solid ${C.border}`, width: 130 }}
            />
            <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
              {CONFS.map(c => (
                <button key={c} onClick={() => setConfFilter(c)}
                  className="shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold"
                  style={{
                    background: confFilter === c ? C.ink : C.card,
                    color:      confFilter === c ? 'white' : C.ink,
                    border:     `1px solid ${confFilter === c ? C.ink : C.border}`,
                  }}>
                  {c}
                </button>
              ))}
            </div>
            <span className="ml-auto text-xs shrink-0" style={{ color: C.muted }}>
              {draft.availableTeams.length} left
            </span>
          </div>

          {/* Team grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
            {filteredTeams.map(t => (
              <button
                key={t.code}
                onClick={() => handlePick(t.code)}
                disabled={!canPick || picking}
                className="card text-left p-3 rounded-xl transition-transform"
                style={{
                  opacity:    (!canPick || picking) ? 0.45 : 1,
                  cursor:     canPick && !picking ? 'pointer' : 'default',
                  outline:    'none',
                }}
                onMouseEnter={e => { if (canPick && !picking) e.currentTarget.style.transform = 'translateY(-2px)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = ''; }}
              >
                <div className="text-2xl mb-1.5">{t.flag}</div>
                <div className="font-semibold text-xs leading-tight">{t.name}</div>
                <div className="text-[9px] mt-0.5 font-mono" style={{ color: C.muted }}>
                  {t.conf} #{t.rank}
                </div>
              </button>
            ))}
            {filteredTeams.length === 0 && (
              <div className="col-span-full py-8 text-center text-sm" style={{ color: C.muted }}>
                No teams match filter
              </div>
            )}
          </div>
        </div>

        {/* Desktop sidebar: pick history + order */}
        <div className="hidden lg:block w-64 shrink-0">
          <PickHistory draft={draft} />
        </div>
      </div>

      {/* Mobile history overlay */}
      {showHistory && (
        <div className="fixed inset-0 z-50 flex items-end lg:hidden"
          onClick={() => setShowHistory(false)}>
          <div
            className="w-full rounded-t-2xl p-5 max-h-[70vh] overflow-y-auto"
            style={{ background: 'white', boxShadow: '0 -4px 24px rgba(0,0,0,0.12)' }}
            onClick={e => e.stopPropagation()}>
            <div className="w-12 h-1 rounded-full mx-auto mb-4" style={{ background: C.border }} />
            <PickHistory draft={draft} />
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Pick countdown timer (SVG ring) ─────────────────────────── */
function PickTimer({ deadline, timerSec }) {
  const [secs, setSecs] = useState(timerSec);

  useEffect(() => {
    if (!deadline) return;
    const target = deadline?.toDate ? deadline.toDate() : new Date(deadline);
    const tick   = () => setSecs(Math.max(0, Math.ceil((target - new Date()) / 1000)));
    tick();
    const id = setInterval(tick, 400);
    return () => clearInterval(id);
  }, [deadline]);

  const isUrgent = secs <= 10;
  const pct      = timerSec > 0 ? Math.min(1, secs / timerSec) : 0;
  const color    = isUrgent ? C.red : C.navy;

  return (
    <div className="relative w-11 h-11 shrink-0">
      <svg className="w-11 h-11 -rotate-90" viewBox="0 0 36 36">
        <circle cx="18" cy="18" r="15.9" fill="none" stroke={C.border} strokeWidth="3" />
        <circle cx="18" cy="18" r="15.9" fill="none"
          stroke={color} strokeWidth="3"
          strokeDasharray={`${pct * 100} 100`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.4s linear, stroke 0.3s' }} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xs font-bold font-mono" style={{ color }}>
          {secs}
        </span>
      </div>
    </div>
  );
}

/* ── Pick history list ────────────────────────────────────────── */
function PickHistory({ draft }) {
  const reversed = [...draft.picks].reverse();

  // Upcoming picks (next 5)
  const upcoming = draft.order
    .slice(draft.currentPickIndex, draft.currentPickIndex + 6)
    .map((memberId, offset) => {
      const member = draft.members.find(m => m.id === memberId);
      return { member, pickNum: draft.currentPickIndex + offset + 1, isCurrent: offset === 0 };
    });

  return (
    <div className="space-y-5">
      {/* On deck */}
      <div>
        <div className="text-xs uppercase tracking-widest font-semibold mb-2.5" style={{ color: C.muted }}>
          On deck
        </div>
        <div className="space-y-1.5">
          {upcoming.map(({ member, pickNum, isCurrent }) => (
            <div key={pickNum}
              className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm"
              style={{
                background: isCurrent ? `${member?.color}20` : C.bg,
                border: isCurrent ? `1.5px solid ${member?.color}` : `1px solid transparent`,
              }}>
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                style={{ background: member?.color }}>
                {member?.name.split(' ').map(w => w[0]).join('').slice(0, 1).toUpperCase()}
              </div>
              <span className="flex-1 font-semibold text-xs truncate">{member?.name.split(' ')[0]}</span>
              <span className="text-[10px] font-mono" style={{ color: C.muted }}>#{pickNum}</span>
            </div>
          ))}
        </div>
      </div>

      {/* History */}
      {reversed.length > 0 && (
        <div>
          <div className="text-xs uppercase tracking-widest font-semibold mb-2.5" style={{ color: C.muted }}>
            Pick history
          </div>
          <div className="space-y-1">
            {reversed.map((pick, i) => {
              const team   = teamByCode[pick.teamCode];
              const member = draft.members.find(m => m.id === pick.memberId);
              const num    = draft.picks.length - i;
              return (
                <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-lg"
                  style={{ background: C.bg }}>
                  <span className="text-[10px] font-mono w-5 text-right shrink-0" style={{ color: C.muted }}>
                    {num}.
                  </span>
                  <div className="w-5 h-5 rounded-full shrink-0 flex items-center justify-center text-[9px] font-bold text-white"
                    style={{ background: member?.color }}>
                    {member?.name.split(' ').map(w => w[0]).join('').slice(0, 1).toUpperCase()}
                  </div>
                  <span className="text-sm leading-none">{team?.flag}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold truncate">{team?.name}</div>
                    {pick.auto && (
                      <div className="text-[9px]" style={{ color: C.muted }}>auto-picked</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
