import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { C } from '../../lib/colors';
import { teamByCode } from '../../lib/teams';
import { calcMemberPoints, POINTS } from '../../lib/scoring';

export default function StandingsTab({ members, matches }) {
  const standings = members
    .map(m => ({ ...m, ...calcMemberPoints(m.teams || [], matches) }))
    .sort((a, b) => b.total - a.total);

  return (
    <div>
      <h3 className="font-display text-3xl mb-6" style={{ fontWeight: 700 }}>Standings</h3>
      <div className="card-lg overflow-hidden">
        {standings.map((m, i) => (
          <MemberRow key={m.id} member={m} rank={i + 1} matches={matches} />
        ))}
        {standings.length === 0 && (
          <div className="p-8 text-center" style={{ color: C.muted }}>
            No members have picked teams yet.
          </div>
        )}
      </div>

      {/* Scoring legend */}
      <div className="card-lg p-6 mt-6">
        <div className="font-display text-xl mb-4" style={{ fontWeight: 700 }}>How scoring works</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[
            ['Group stage win',       `${POINTS.groupWin} pts`],
            ['Group stage draw',      `${POINTS.groupDraw} pt`],
            ['Group stage loss',      '0 pts'],
            ['Round of 32 win',       `${POINTS.koWin} pts`],
            ['Round of 16 win',       `${POINTS.koWin} pts`],
            ['Quarterfinal win',      `${POINTS.koWin} pts`],
            ['Semifinal win',         `${POINTS.koWin} pts`],
            ['World Cup Final win',   `${POINTS.finalWin} pts`],
            ['Third-place game win',  '0 pts'],
          ].map(([label, val]) => (
            <div key={label} className="flex justify-between items-center py-1.5 px-3 rounded-lg"
              style={{ background: C.bg }}>
              <span className="text-sm" style={{ color: C.muted }}>{label}</span>
              <span className="font-bold text-sm font-mono">{val}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MemberRow({ member, rank, matches }) {
  const [expanded, setExpanded] = useState(false);
  const { total, breakdown } = calcMemberPoints(member.teams || [], matches);
  const initials = member.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="border-b last:border-b-0" style={{ borderColor: C.border }}>
      <div className="flex items-center gap-4 p-4 cursor-pointer"
        onClick={() => setExpanded(e => !e)}>
        <div className="font-display text-2xl w-8 shrink-0"
          style={{ fontWeight: 800, color: rank === 1 ? C.gold : rank === 2 ? C.muted : C.ink }}>
          {rank}
        </div>
        <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
          style={{ background: member.color }}>
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold">{member.name}</div>
          <div className="text-xl mt-0.5 leading-tight">
            {(member.teams || []).map(c => teamByCode[c]?.flag).filter(Boolean).join(' ')}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="font-display text-2xl" style={{ fontWeight: 800 }}>{total}</div>
          <div className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: C.muted }}>pts</div>
        </div>
        <div style={{ color: C.muted }}>
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </div>

      {expanded && breakdown && (
        <div className="px-6 pb-4">
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-2">
            {Object.entries(breakdown).map(([code, { pts, stats }]) => {
              const team = teamByCode[code];
              if (!team) return null;
              const milestones = [
                stats.r32Win   && 'R32 ✓',
                stats.r16Win   && 'R16 ✓',
                stats.qfWin    && 'QF ✓',
                stats.sfWin    && 'SF ✓',
                stats.finalWin && '🏆 Champion',
                stats.thirdWin && '3rd place',
              ].filter(Boolean);
              return (
                <div key={code} className="p-3 rounded-lg" style={{ background: C.bg }}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">{team.flag}</span>
                    <span className="font-semibold text-sm truncate">{team.name}</span>
                    <span className="ml-auto font-bold font-mono text-sm shrink-0"
                      style={{ color: C.navy }}>
                      {pts} pts
                    </span>
                  </div>
                  <div className="text-[10px]" style={{ color: C.muted }}>
                    {stats.groupWins}W {stats.groupDraws}D {stats.groupLosses}L
                    {milestones.length > 0 && ` · ${milestones.join(' · ')}`}
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
