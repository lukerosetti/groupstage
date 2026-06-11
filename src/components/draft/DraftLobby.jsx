import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Copy, Check, Shuffle, Play, Users } from 'lucide-react';
import { C } from '../../lib/colors';

const TIMER_OPTIONS = [30, 60, 90, 120, 180];

export default function DraftLobby({
  pool, members, draft, poolId,
  isCommissioner, myMember,
  onInit, onStart, onReset, onPresence,
}) {
  const [timerSec, setTimerSec]       = useState(draft?.timerSec || 90);
  const [memberOrder, setMemberOrder] = useState(null);
  const [starting, setStarting]       = useState(false);
  const [copied, setCopied]           = useState(false);
  const [initing, setIniting]         = useState(false);

  // Include all pool members — join-link status shouldn't gate the draft
  const allMembers     = members.filter(m => m.status === 'joined' || m.status === 'invited');
  const orderedMembers = memberOrder || allMembers;
  const roomUrl        = `${window.location.origin}/p/${poolId}/room`;

  // Presence heartbeat
  useEffect(() => {
    if (!myMember?.id || !draft) return;
    onPresence(myMember.id);
    const id = setInterval(() => onPresence(myMember.id), 15000);
    return () => clearInterval(id);
  }, [myMember?.id, !!draft]);

  // Commissioner auto-creates lobby doc when landing (if none exists)
  useEffect(() => {
    if (!isCommissioner || draft || initing || allMembers.length === 0) return;
    setIniting(true);
    onInit(allMembers, timerSec).finally(() => setIniting(false));
  }, [isCommissioner, draft === null, allMembers.length]);

  function copyLink() {
    navigator.clipboard.writeText(roomUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }

  function shuffle() {
    const arr = [...orderedMembers];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    setMemberOrder(arr);
  }

  async function handleStart() {
    setStarting(true);
    try {
      // Re-init if order changed or timer changed
      await onInit(orderedMembers, timerSec);
      await onStart(timerSec);
    } catch (err) {
      console.error('Start draft error:', err);
    } finally {
      setStarting(false);
    }
  }

  // Who's "online" — presence updated in last 30 s
  const now       = Date.now();
  const onlineIds = new Set(
    Object.entries(draft?.presence || {})
      .filter(([, ts]) => now - Number(ts) < 30000)
      .map(([id]) => id),
  );

  const teamsPerMember = draft
    ? draft.teamsPerMember
    : Math.floor(48 / Math.max(1, allMembers.length));

  const canStart = allMembers.length >= 2;

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <Link to={`/p/${poolId}`}
        className="text-sm font-semibold no-underline mb-6 inline-flex items-center gap-1.5"
        style={{ color: C.muted }}>
        ← Back to pool
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-8 flex-wrap gap-4">
        <div>
          <div className="text-xs uppercase tracking-widest font-semibold mb-1" style={{ color: C.muted }}>
            {pool?.name}
          </div>
          <h1 className="font-display text-4xl" style={{ fontWeight: 800 }}>Draft Room</h1>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {draft?.joinCode && (
            <div className="card px-4 py-2 text-center">
              <div className="text-[9px] uppercase tracking-widest font-semibold mb-0.5" style={{ color: C.muted }}>
                Room code
              </div>
              <div className="font-mono font-bold text-lg tracking-[0.2em]">{draft.joinCode}</div>
            </div>
          )}
          <button onClick={copyLink}
            className="card px-4 py-2.5 text-sm font-semibold flex items-center gap-2">
            {copied
              ? <Check size={14} style={{ color: C.green }} />
              : <Copy size={14} style={{ color: C.muted }} />}
            {copied ? 'Copied!' : 'Copy invite link'}
          </button>
        </div>
      </div>

      {/* Member list */}
      <div className="card-lg p-6 mb-5">
        <div className="flex items-center gap-2 mb-4">
          <Users size={15} style={{ color: C.muted }} />
          <span className="font-semibold text-sm">
            Members &nbsp;<span style={{ color: C.muted }}>({allMembers.length})</span>
          </span>
          <div className="flex-1" />
          <span className="text-xs" style={{ color: C.muted }}>
            {onlineIds.size} online now
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {orderedMembers.map((m, i) => {
            const online = onlineIds.has(m.id);
            const isMe   = m.id === myMember?.id;
            return (
              <div key={m.id}
                className="flex items-center gap-3 p-3 rounded-xl"
                style={{
                  background:    isMe ? `${m.color}12` : C.bg,
                  border:        `${isMe ? 1.5 : 1}px solid ${isMe ? m.color : C.border}`,
                }}>
                <div className="relative shrink-0">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white"
                    style={{ background: m.color }}>
                    {m.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2"
                    style={{ background: online ? C.green : C.border, borderColor: 'white' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">
                    {m.name}{isMe ? ' (you)' : ''}
                  </div>
                  <div className="text-[10px]" style={{ color: C.muted }}>
                    Pick #{i + 1}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Commissioner controls */}
      {isCommissioner ? (
        <div className="card-lg p-6 space-y-5">
          <div className="font-semibold text-sm">Draft Settings</div>

          {/* Timer */}
          <div>
            <div className="text-xs uppercase tracking-widest font-semibold mb-2.5" style={{ color: C.muted }}>
              Time per pick
            </div>
            <div className="flex gap-2 flex-wrap">
              {TIMER_OPTIONS.map(s => (
                <button key={s} onClick={() => setTimerSec(s)}
                  className="px-4 py-2 rounded-full text-sm font-semibold"
                  style={{
                    background:  timerSec === s ? C.navy : C.bg,
                    color:       timerSec === s ? 'white' : C.ink,
                    border:      `1px solid ${timerSec === s ? C.navy : C.border}`,
                  }}>
                  {s}s
                </button>
              ))}
            </div>
          </div>

          {/* Draft order */}
          <div>
            <div className="text-xs uppercase tracking-widest font-semibold mb-2.5" style={{ color: C.muted }}>
              Draft order <span style={{ fontWeight: 400 }}>(snake reversal each round)</span>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex gap-1.5 flex-wrap">
                {orderedMembers.map((m, i) => (
                  <div key={m.id}
                    className="text-xs px-2.5 py-1 rounded-full font-semibold text-white"
                    style={{ background: m.color }}>
                    {i + 1}. {m.name.split(' ')[0]}
                  </div>
                ))}
              </div>
              <button onClick={shuffle}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg shrink-0"
                style={{ background: C.bg, border: `1px solid ${C.border}` }}>
                <Shuffle size={12} /> Shuffle
              </button>
            </div>
          </div>

          {/* Start row */}
          <div className="pt-4 border-t flex items-center justify-between flex-wrap gap-3"
            style={{ borderColor: C.border }}>
            <div className="text-sm" style={{ color: C.muted }}>
              <span style={{ color: C.ink, fontWeight: 600 }}>{allMembers.length} members</span>
              {' · '}{teamsPerMember} teams each
              {' · '}{allMembers.length * teamsPerMember} total picks
            </div>
            <button onClick={handleStart} disabled={starting || !canStart}
              className="flex items-center gap-2 px-6 py-3 rounded-xl font-display font-bold text-base"
              style={{
                background: canStart ? C.navy : C.border,
                color:      'white',
                opacity:    (starting || !canStart) ? 0.6 : 1,
              }}>
              <Play size={16} fill="white" />
              {starting ? 'Starting…' : 'Start Draft'}
            </button>
          </div>
          {!canStart && (
            <div className="text-xs -mt-2" style={{ color: C.muted }}>
              Need at least 2 joined members to start.
            </div>
          )}
        </div>
      ) : (
        /* Non-commissioner waiting state */
        <div className="card-lg p-8 text-center">
          <div className="text-4xl mb-3">⏳</div>
          <div className="font-semibold mb-1">Waiting for the commissioner to start</div>
          <div className="text-sm" style={{ color: C.muted }}>
            Stay on this page — the draft will begin automatically.
          </div>
        </div>
      )}
    </div>
  );
}
