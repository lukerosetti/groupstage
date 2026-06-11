import { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { C } from '../../lib/colors';
import { teamByCode } from '../../lib/teams';

// Full 2026 WC knockout structure: R32 → R16 → QF → SF → Final + bronze
// NOTE: third-place is rendered separately (after SF column) to avoid breaking
// the horizontal flow — the bronze match runs alongside the Final column.
const KNOCKOUT_ROUNDS = ['r32', 'r16', 'qf', 'sf', 'final', 'third'];
const ROUND_LABELS = {
  r32:   'Round of 32',
  r16:   'Round of 16',
  qf:    'Quarterfinals',
  sf:    'Semifinals',
  final: 'Final',
  third: '3rd Place',
};

// 2026 World Cup: 12 groups → top 2 from each (24) + best 8 third-place = 32
// So position 1 & 2: guaranteed advance; position 3: may advance (best 8 of 12); position 4: eliminated
const ADV_GUARANTEED = 2; // top 2 guaranteed
// 3rd place shown as "maybe" — we highlight differently

function parseGroupLetter(raw) {
  if (!raw) return null;
  const m = String(raw).match(/([A-L])$/i);
  return m ? m[1].toUpperCase() : null;
}

export default function BracketTab({ matches, members = [] }) {
  const [view, setView] = useState('group');

  return (
    <div>
      <div className="flex gap-2 mb-6">
        <button onClick={() => setView('group')}
          className="px-4 py-2 rounded-full text-sm font-semibold"
          style={{ background: view === 'group' ? C.ink : C.card, color: view === 'group' ? 'white' : C.ink, border: `1px solid ${view === 'group' ? C.ink : C.border}` }}>
          Group Stage
        </button>
        <button onClick={() => setView('knockout')}
          className="px-4 py-2 rounded-full text-sm font-semibold"
          style={{ background: view === 'knockout' ? C.ink : C.card, color: view === 'knockout' ? 'white' : C.ink, border: `1px solid ${view === 'knockout' ? C.ink : C.border}` }}>
          Knockout
        </button>
      </div>

      {view === 'group' && <GroupStageView matches={matches} members={members} />}
      {view === 'knockout' && <KnockoutView matches={matches} />}
    </div>
  );
}

function GroupStageView({ matches, members }) {
  const groupMatches = matches.filter(m => m.round === 'group');

  // Build standings per group — recomputed every render so it's always live
  const groups = {};
  for (const m of groupMatches) {
    const letter = parseGroupLetter(m.group);
    if (!letter) continue;

    groups[letter] = groups[letter] || {};
    for (const code of [m.homeTeam, m.awayTeam]) {
      if (code && !groups[letter][code]) {
        groups[letter][code] = { mp: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 };
      }
    }

    if (m.status === 'completed' && m.score && m.homeTeam && m.awayTeam) {
      const hScore = m.score.home ?? 0;
      const aScore = m.score.away ?? 0;
      const h = groups[letter][m.homeTeam];
      const a = groups[letter][m.awayTeam];
      if (!h || !a) continue;

      h.mp++; a.mp++;
      h.gf += hScore; h.ga += aScore;
      a.gf += aScore; a.ga += hScore;

      if (hScore > aScore)      { h.w++; h.pts += 3; a.l++; }
      else if (hScore < aScore) { a.w++; a.pts += 3; h.l++; }
      else                      { h.d++; h.pts++; a.d++; a.pts++; }
    }
  }

  const letters = Object.keys(groups).sort();

  if (letters.length === 0) {
    return <div className="py-12 text-center" style={{ color: C.muted }}>Group stage data loading…</div>;
  }

  // Build a map of teamCode → owner member for quick lookup
  const ownerByTeam = {};
  for (const m of members) {
    for (const code of (m.teams || [])) {
      ownerByTeam[code] = m;
    }
  }

  return (
    <div>
      {/* Advancement legend */}
      <div className="flex flex-wrap items-center gap-4 mb-5 px-1">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm" style={{ background: 'rgba(30,58,111,0.15)', border: `2px solid ${C.navy}` }} />
          <span className="text-xs" style={{ color: C.muted }}>Top 2 advance</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm" style={{ background: 'rgba(201,161,74,0.15)', border: `2px solid ${C.gold}` }} />
          <span className="text-xs" style={{ color: C.muted }}>3rd — best 8 may advance</span>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5">
        {letters.map(letter => (
          <GroupTable key={letter} letter={letter} teams={groups[letter]} ownerByTeam={ownerByTeam} />
        ))}
      </div>
    </div>
  );
}

function GroupTable({ letter, teams, ownerByTeam }) {
  // Sort: pts → GD → GF → wins — this runs on every render so rows move live
  const rows = Object.entries(teams)
    .map(([code, s]) => ({ code, ...s, gd: s.gf - s.ga }))
    .sort((a, b) =>
      b.pts - a.pts ||
      b.gd - a.gd ||
      b.gf - a.gf ||
      b.w - a.w
    );

  return (
    <div className="card-lg overflow-hidden">
      <div className="px-4 py-3" style={{ background: C.navy }}>
        <div className="font-display text-base text-white" style={{ fontWeight: 700, letterSpacing: '-0.01em' }}>
          Group {letter}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{ minWidth: 280 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.border}` }}>
              <th className="text-left pl-3 pr-1 py-2 font-semibold text-xs uppercase tracking-widest" style={{ color: C.muted }}>Team</th>
              <th className="px-1.5 py-2 font-semibold text-xs text-center" style={{ color: C.muted }} title="Played">P</th>
              <th className="px-1.5 py-2 font-semibold text-xs text-center" style={{ color: C.muted }} title="Won">W</th>
              <th className="px-1.5 py-2 font-semibold text-xs text-center" style={{ color: C.muted }} title="Drawn">D</th>
              <th className="px-1.5 py-2 font-semibold text-xs text-center" style={{ color: C.muted }} title="Lost">L</th>
              <th className="px-1.5 py-2 font-semibold text-xs text-center" style={{ color: C.muted }} title="Goal Difference">GD</th>
              <th className="px-1.5 py-2 font-semibold text-xs text-center pr-3" style={{ color: C.navy }} title="Points">Pts</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const team = teamByCode[r.code];
              const owner = ownerByTeam[r.code];
              const isGuaranteed = i < ADV_GUARANTEED;
              const isMaybe = i === 2; // 3rd place
              const isEliminated = i === 3;

              let rowBg = 'transparent';
              let borderLeft = '3px solid transparent';
              if (isGuaranteed) { rowBg = 'rgba(30,58,111,0.04)'; borderLeft = `3px solid ${C.navy}`; }
              if (isMaybe)      { rowBg = 'rgba(201,161,74,0.04)'; borderLeft = `3px solid ${C.gold}`; }

              return (
                <tr key={r.code} style={{ background: rowBg, borderBottom: `1px solid ${C.border}`, borderLeft }}>
                  <td className="pl-3 pr-1 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-base leading-none shrink-0">{team?.flag}</span>
                      <span className="font-semibold text-xs leading-tight flex-1" style={{ wordBreak: 'break-word', opacity: isEliminated && r.mp === 3 ? 0.45 : 1 }}>
                        {team?.name || r.code}
                      </span>
                      {/* Pool member owner dot */}
                      {owner && (
                        <span className="w-2 h-2 rounded-full shrink-0 ml-0.5" style={{ background: owner.color }} title={owner.name} />
                      )}
                    </div>
                  </td>
                  <td className="px-1.5 py-2 text-center font-mono text-xs" style={{ color: C.muted }}>{r.mp}</td>
                  <td className="px-1.5 py-2 text-center font-mono text-xs">{r.w}</td>
                  <td className="px-1.5 py-2 text-center font-mono text-xs">{r.d}</td>
                  <td className="px-1.5 py-2 text-center font-mono text-xs">{r.l}</td>
                  <td className="px-1.5 py-2 text-center font-mono text-xs" style={{ color: r.gd > 0 ? C.green : r.gd < 0 ? C.red : C.muted }}>
                    {r.gd > 0 ? `+${r.gd}` : r.gd}
                  </td>
                  <td className="px-1.5 py-2 text-center font-bold font-mono pr-3" style={{ color: C.navy }}>{r.pts}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function KnockoutView({ matches }) {
  const knockout = matches.filter(m => m.round !== 'group');
  if (knockout.length === 0) {
    return (
      <div className="py-12 text-center" style={{ color: C.muted }}>
        Knockout rounds begin after the group stage. Check back later.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-6 min-w-max pb-4">
        {KNOCKOUT_ROUNDS.map(round => {
          const roundMatches = knockout.filter(m => m.round === round);
          if (roundMatches.length === 0) return null;
          return (
            <div key={round} className="flex flex-col gap-4" style={{ minWidth: 220 }}>
              <div className="text-xs uppercase tracking-widest font-semibold text-center" style={{ color: C.muted }}>
                {ROUND_LABELS[round]}
              </div>
              {roundMatches.map(m => (
                <KnockoutCard key={m.id} match={m} isFinal={round === 'final'} isThird={round === 'third'} />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function KnockoutCard({ match, isFinal, isThird }) {
  const home = teamByCode[match.homeTeam];
  const away = teamByCode[match.awayTeam];

  // Determine winner: use m.winner for penalty shootout deciders,
  // else fall back to fullTime score comparison.
  const homeWon = match.winner
    ? match.winner === match.homeTeam
    : match.score?.home != null && match.score.home > match.score.away;
  const awayWon = match.winner
    ? match.winner === match.awayTeam
    : match.score?.away != null && match.score.away > match.score.home;
  const wentToPens = !!(match.winner && match.score?.home === match.score?.away);

  const sofascoreUrl = `https://www.sofascore.com/search#query=${encodeURIComponent((home?.name || '') + ' ' + (away?.name || ''))}`;

  const borderColor = isFinal ? C.gold : isThird ? '#CD7F32' : undefined;

  return (
    <div className="card-lg overflow-hidden"
      style={{ border: (isFinal || isThird) ? `2px solid ${borderColor}` : undefined }}>
      {isFinal && (
        <div className="px-4 py-2 text-center text-xs font-bold uppercase tracking-widest"
          style={{ background: C.gold, color: 'white' }}>
          ★ World Cup Final
        </div>
      )}
      {isThird && (
        <div className="px-4 py-2 text-center text-xs font-bold uppercase tracking-widest"
          style={{ background: '#CD7F32', color: 'white' }}>
          🥉 3rd Place · 0 pts
        </div>
      )}
      <div className="p-3 space-y-1.5">
        <KnockoutTeamRow team={home} score={match.score?.home} won={homeWon} lost={awayWon} />
        <div className="h-px" style={{ background: C.border }} />
        <KnockoutTeamRow team={away} score={match.score?.away} won={awayWon} lost={homeWon} />
      </div>
      {wentToPens && (
        <div className="px-3 pb-1 text-[10px] font-semibold" style={{ color: C.muted }}>
          Won on penalties
        </div>
      )}
      <div className="px-3 pb-2.5">
        <a href={sofascoreUrl} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1 text-[11px] font-semibold no-underline"
          style={{ color: C.muted }}>
          <ExternalLink size={10} />
          Live stats &amp; lineups on Sofascore
        </a>
      </div>
    </div>
  );
}

function KnockoutTeamRow({ team, score, won, lost }) {
  return (
    <div className="flex items-center gap-2 py-0.5" style={{ opacity: lost ? 0.4 : 1 }}>
      <span className="text-xl">{team?.flag || '?'}</span>
      <span className="flex-1 font-semibold text-sm">{team?.name || 'TBD'}</span>
      {score != null && (
        <span className="font-bold font-mono" style={{ color: won ? C.navy : C.muted }}>{score}</span>
      )}
    </div>
  );
}
