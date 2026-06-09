import { useState, useEffect, useRef } from 'react';
import { C } from '../../lib/colors';
import { teamByCode } from '../../lib/teams';
import { format, isToday, isFuture, isPast } from 'date-fns';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { fetchMatch, normalizeStatus } from '../../lib/footballApi';

const SUB_TABS = [
  { id: 'live', label: 'Live' },
  { id: 'today', label: 'Today' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'completed', label: 'Completed' },
];

export default function ScheduleTab({ matches, members }) {
  const [sub, setSub] = useState('today');

  const liveMatches = matches.filter(m => m.status === 'live');
  const getDate = (m) => m.kickoff?.toDate ? m.kickoff.toDate() : new Date(m.kickoff);

  const filtered = matches.filter(m => {
    if (!m.kickoff) return false;
    const d = getDate(m);
    if (sub === 'live') return m.status === 'live';
    if (sub === 'today') return isToday(d) && m.status !== 'live';
    if (sub === 'upcoming') return isFuture(d) && m.status === 'scheduled';
    if (sub === 'completed') return m.status === 'completed';
    return true;
  });

  // Poll live matches every 30s
  useEffect(() => {
    if (liveMatches.length === 0) return;
    const interval = setInterval(async () => {
      for (const m of liveMatches) {
        try {
          if (!import.meta.env.VITE_FOOTBALL_DATA_KEY) continue;
          const data = await fetchMatch(m.apiId || m.id);
          await updateDoc(doc(db, 'matches', m.id), {
            score: { home: data.score?.fullTime?.home ?? 0, away: data.score?.fullTime?.away ?? 0 },
            minute: data.minute || null,
            status: normalizeStatus(data.status),
            lastUpdated: new Date(),
          });
        } catch { /* ignore */ }
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [liveMatches.length]);

  return (
    <div>
      <div className="flex gap-2 mb-6 flex-wrap">
        {SUB_TABS.map(t => (
          <button key={t.id} onClick={() => setSub(t.id)}
            className="px-4 py-2 rounded-full text-sm font-semibold flex items-center gap-2"
            style={{
              background: sub === t.id ? C.ink : C.card,
              color: sub === t.id ? 'white' : C.ink,
              border: `1px solid ${sub === t.id ? C.ink : C.border}`,
            }}>
            {t.id === 'live' && (
              <div className="w-2 h-2 rounded-full" style={{ background: sub === t.id ? 'white' : C.red, ...(sub === t.id ? {} : { animation: 'pulse-dot 1.6s infinite' }) }} />
            )}
            {t.label}
            {t.id === 'live' && liveMatches.length > 0 && (
              <span className="text-xs font-bold px-1.5 py-0.5 rounded-full" style={{ background: C.red, color: 'white' }}>
                {liveMatches.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="py-12 text-center" style={{ color: C.muted }}>No matches in this category.</div>
      )}

      <div className="space-y-3">
        {filtered.map(m => (
          <MatchCard key={m.id} match={m} members={members} />
        ))}
      </div>
    </div>
  );
}

function MatchCard({ match, members }) {
  const home = teamByCode[match.homeTeam];
  const away = teamByCode[match.awayTeam];
  const isLive = match.status === 'live';
  const isDone = match.status === 'completed';
  const getDate = () => match.kickoff?.toDate ? match.kickoff.toDate() : new Date(match.kickoff);

  const ownersHome = members.filter(m => m.teams?.includes(match.homeTeam));
  const ownersAway = members.filter(m => m.teams?.includes(match.awayTeam));

  return (
    <div className="card-lg p-5 relative overflow-hidden"
      style={{ borderColor: isLive ? C.red : undefined, borderWidth: isLive ? 2 : 1 }}>
      {isLive && <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: C.red }} />}

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {isLive && (
            <>
              <div className="w-2 h-2 rounded-full pulse-dot" style={{ background: C.red }} />
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: C.red }}>
                Live{match.minute ? ` · ${match.minute}'` : ''}
              </span>
            </>
          )}
          {isDone && <span className="text-xs font-bold uppercase tracking-widest" style={{ color: C.muted }}>Full Time</span>}
          {!isLive && !isDone && match.kickoff && (
            <span className="text-xs font-mono" style={{ color: C.muted }}>
              {format(getDate(), 'MMM d · h:mm a')}
            </span>
          )}
        </div>
        <div className="text-[10px] uppercase tracking-widest font-semibold px-2 py-0.5 rounded-full"
          style={{ background: C.bg, color: C.muted }}>
          {match.round === 'group' ? `Group ${match.groupLetter || ''}` : match.round?.toUpperCase()}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <TeamSide team={home} score={match.score?.home} owners={ownersHome} isWinner={match.score && match.score.home > match.score.away} />

        <div className="flex-1 text-center">
          {(isLive || isDone) && match.score ? (
            <div className="font-display text-4xl" style={{ fontWeight: 800 }}>
              {match.score.home} <span style={{ color: C.muted, fontWeight: 400 }}>–</span> {match.score.away}
            </div>
          ) : (
            <div className="text-sm font-mono" style={{ color: C.muted }}>vs</div>
          )}
        </div>

        <TeamSide team={away} score={match.score?.away} owners={ownersAway} isWinner={match.score && match.score.away > match.score.home} right />
      </div>

      {match.venue && (
        <div className="mt-3 text-xs" style={{ color: C.muted }}>{match.venue}</div>
      )}
    </div>
  );
}

function TeamSide({ team, score, owners, isWinner, right }) {
  if (!team) return <div className="flex-1" />;
  return (
    <div className={`flex-1 flex flex-col ${right ? 'items-end text-right' : 'items-start'} gap-1`}>
      <div className={`flex items-center gap-2 ${right ? 'flex-row-reverse' : ''}`}>
        <span className="text-2xl">{team.flag}</span>
        <span className="font-semibold">{team.name}</span>
        {isWinner && <span className="text-xs" style={{ color: C.gold }}>✓</span>}
      </div>
      {owners.length > 0 && (
        <div className={`flex gap-1 ${right ? 'flex-row-reverse' : ''}`}>
          {owners.map(o => (
            <div key={o.id} className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold text-white"
              style={{ background: o.color }}>
              {o.name.split(' ')[0]}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
