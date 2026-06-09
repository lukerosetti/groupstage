import { Copy, Check } from 'lucide-react';
import { useState } from 'react';
import { C } from '../../lib/colors';
import { teamByCode } from '../../lib/teams';
import { calcMemberPoints } from '../../lib/scoring';
import { isToday } from 'date-fns';

export default function OverviewTab({ pool, members, matches, poolId, inviteUrl }) {
  const standings = members
    .map(m => ({ ...m, ...calcMemberPoints(m.teams || [], matches) }))
    .sort((a, b) => b.total - a.total);

  const allOwnedCodes = new Set(members.flatMap(m => m.teams || []));
  const todayMatches = matches.filter(m => {
    if (!m.kickoff) return false;
    const d = m.kickoff?.toDate ? m.kickoff.toDate() : new Date(m.kickoff);
    return isToday(d) && (allOwnedCodes.has(m.homeTeam) || allOwnedCodes.has(m.awayTeam));
  });

  return (
    <div className="space-y-6">
      {/* Member cards */}
      <div>
        <h3 className="font-display text-xl mb-4" style={{ fontWeight: 700 }}>Members</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {members.map(m => (
            <MemberCard key={m.id} member={m} />
          ))}
          {Array.from({ length: Math.max(0, pool.memberCount - members.length) }).map((_, i) => (
            <EmptySlot key={i} />
          ))}
        </div>
      </div>

      {/* Standings preview */}
      {standings.length > 0 && (
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
      {todayMatches.length > 0 && (
        <div>
          <h3 className="font-display text-xl mb-4" style={{ fontWeight: 700 }}>Your teams today</h3>
          <div className="grid sm:grid-cols-2 gap-3">
            {todayMatches.map(m => (
              <TodayMatchCard key={m.id} match={m} members={members} />
            ))}
          </div>
        </div>
      )}

      {/* Invite section */}
      <div>
        <h3 className="font-display text-xl mb-4" style={{ fontWeight: 700 }}>Invite friends</h3>
        <div className="card-lg p-6">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="font-mono text-sm truncate" style={{ color: C.navy }}>{inviteUrl}</div>
            <CopyButton url={inviteUrl} />
          </div>
          <div className="text-xs mt-3" style={{ color: C.muted }}>
            Share this link with friends. They'll enter their name + email and pick their teams.
          </div>
        </div>
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
    <button onClick={copy} className="px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2"
      style={{ background: C.navy, color: 'white' }}>
      {copied ? <Check size={14} /> : <Copy size={14} />}
      {copied ? 'Copied!' : 'Copy link'}
    </button>
  );
}
