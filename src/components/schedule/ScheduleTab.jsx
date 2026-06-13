import { useState, useEffect } from 'react';
import { ExternalLink } from 'lucide-react';
import { C } from '../../lib/colors';
import { teamByCode } from '../../lib/teams';
import { format, isToday, isFuture, isYesterday } from 'date-fns';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { fetchMatch, normalizeStatus } from '../../lib/footballApi';

const SUB_TABS = [
  { id: 'live',      label: 'Live' },
  { id: 'today',     label: 'Today' },
  { id: 'upcoming',  label: 'Upcoming' },
  { id: 'completed', label: 'Completed' },
];

function parseGroupLetter(raw) {
  if (!raw) return '';
  const m = String(raw).match(/([A-L])$/i);
  return m ? m[1].toUpperCase() : '';
}

export default function ScheduleTab({ matches, members }) {
  const [sub, setSub] = useState('today');
  const liveMatches = matches.filter(m => m.status === 'live');
  const getDate = m => m.kickoff?.toDate ? m.kickoff.toDate() : new Date(m.kickoff);

  const filtered = matches.filter(m => {
    if (!m.kickoff) return false;
    const d = getDate(m);
    if (sub === 'live')      return m.status === 'live';
    if (sub === 'today')     return isToday(d);   // include live + scheduled + completed today
    if (sub === 'upcoming')  return isFuture(d) && m.status === 'scheduled' && !isToday(d);
    if (sub === 'completed') return m.status === 'completed';
    return true;
  });

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
      {/* Single-row scrollable filter chips */}
      <div className="flex gap-2 mb-6 overflow-x-auto scrollbar-hide pb-1" style={{ WebkitOverflowScrolling: 'touch' }}>
        {SUB_TABS.map(t => (
          <button key={t.id} onClick={() => setSub(t.id)}
            className="shrink-0 px-4 py-2 rounded-full text-sm font-semibold flex items-center gap-2"
            style={{
              background: sub === t.id ? C.ink : C.card,
              color: sub === t.id ? 'white' : C.ink,
              border: `1px solid ${sub === t.id ? C.ink : C.border}`,
            }}>
            {t.id === 'live' && (
              <div className="w-2 h-2 rounded-full"
                style={{ background: sub === t.id ? 'white' : C.red,
                  ...(sub !== t.id ? { animation: 'pulse-dot 1.6s infinite' } : {}) }} />
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

      {/* Group by date */}
      {(() => {
        const byDate = {};
        for (const m of filtered) {
          const d = getDate(m);
          const key = format(d, 'yyyy-MM-dd');
          byDate[key] = byDate[key] || { label: formatDayLabel(d), matches: [] };
          byDate[key].matches.push(m);
        }
        return Object.entries(byDate).map(([key, { label, matches: dayMatches }]) => (
          <div key={key} className="space-y-3 mb-6">
            <div className="flex items-center gap-3">
              <div className="font-semibold text-sm" style={{ color: C.ink }}>{label}</div>
              <div className="flex-1 h-px" style={{ background: C.border }} />
              <div className="text-xs font-mono" style={{ color: C.muted }}>{dayMatches.length} match{dayMatches.length !== 1 ? 'es' : ''}</div>
            </div>
            {dayMatches.map(m => <MatchCard key={m.id} match={m} members={members} />)}
          </div>
        ));
      })()}
    </div>
  );
}

function formatDayLabel(date) {
  if (isToday(date))     return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'EEE, MMM d');
}

function MatchCard({ match, members }) {
  const home = teamByCode[match.homeTeam];
  const away = teamByCode[match.awayTeam];
  const isLive = match.status === 'live';
  const isDone = match.status === 'completed';
  const getDate = () => match.kickoff?.toDate ? match.kickoff.toDate() : new Date(match.kickoff);

  const ownersHome = members.filter(m => m.teams?.includes(match.homeTeam));
  const ownersAway = members.filter(m => m.teams?.includes(match.awayTeam));

  const groupLetter = parseGroupLetter(match.group);
  const roundLabel = match.round === 'group'
    ? `Group ${groupLetter}`
    : match.round?.toUpperCase();

  return (
    <div className="card-lg overflow-hidden"
      style={{ borderColor: isLive ? C.red : undefined, borderWidth: isLive ? 2 : 1 }}>
      {isLive && <div className="h-0.5 w-full" style={{ background: C.red }} />}

      {/* Header row */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
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
        <span className="text-[10px] uppercase tracking-widest font-semibold px-2 py-0.5 rounded-full"
          style={{ background: C.bg, color: C.muted }}>
          {roundLabel}
        </span>
      </div>

      {/* Teams row */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 pb-4">
        {/* Home */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5">
            <span className="text-xl leading-none">{home?.flag}</span>
            <span className="font-semibold text-sm leading-tight">{home?.name || match.homeName}</span>
          </div>
          {ownersHome.length > 0 && (
            <div className="flex gap-1 flex-wrap">
              {ownersHome.map(o => (
                <span key={o.id} className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold text-white"
                  style={{ background: o.color }}>{o.name.split(' ')[0]}</span>
              ))}
            </div>
          )}
        </div>

        {/* Score / VS */}
        <div className="text-center px-1">
          {(isLive || isDone) && match.score != null ? (
            <div className="font-display text-2xl font-bold leading-none">
              {match.score.home}<span className="mx-1" style={{ color: C.muted, fontWeight: 400 }}>–</span>{match.score.away}
            </div>
          ) : (
            <span className="text-xs font-mono" style={{ color: C.muted }}>vs</span>
          )}
        </div>

        {/* Away */}
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-1.5 flex-row-reverse">
            <span className="text-xl leading-none">{away?.flag}</span>
            <span className="font-semibold text-sm leading-tight text-right">{away?.name || match.awayName}</span>
          </div>
          {ownersAway.length > 0 && (
            <div className="flex gap-1 flex-wrap justify-end">
              {ownersAway.map(o => (
                <span key={o.id} className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold text-white"
                  style={{ background: o.color }}>{o.name.split(' ')[0]}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Sofascore link */}
      <div className="px-4 pb-3">
        <a href={`https://www.sofascore.com/search#query=${encodeURIComponent((home?.name || match.homeName || '') + ' ' + (away?.name || match.awayName || ''))}`}
          target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1 text-[11px] font-semibold no-underline"
          style={{ color: C.muted }}>
          <ExternalLink size={10} />
          Live stats &amp; lineups on Sofascore
        </a>
      </div>
    </div>
  );
}
