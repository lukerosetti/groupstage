import { useState } from 'react';
import { C } from '../../lib/colors';
import { teamByCode } from '../../lib/teams';

const GROUPS = 'ABCDEFGHIJKL'.split('');
const KNOCKOUT_ROUNDS = ['r32', 'r16', 'qf', 'sf', 'final'];
const ROUND_LABELS = { r32: 'Round of 32', r16: 'Round of 16', qf: 'Quarterfinals', sf: 'Semifinals', final: 'Final' };

export default function BracketTab({ matches }) {
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

      {view === 'group' && <GroupStageView matches={matches} />}
      {view === 'knockout' && <KnockoutView matches={matches} />}
    </div>
  );
}

function GroupStageView({ matches }) {
  const groupMatches = matches.filter(m => m.round === 'group');

  // Build standings per group
  const groups = {};
  for (const m of groupMatches) {
    if (!m.groupLetter) continue;
    groups[m.groupLetter] = groups[m.groupLetter] || {};
    for (const code of [m.homeTeam, m.awayTeam]) {
      if (code && !groups[m.groupLetter][code]) {
        groups[m.groupLetter][code] = { w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 };
      }
    }
    if (m.status === 'completed' && m.score && m.homeTeam && m.awayTeam) {
      const h = groups[m.groupLetter][m.homeTeam];
      const a = groups[m.groupLetter][m.awayTeam];
      if (!h || !a) continue;
      h.gf += m.score.home; h.ga += m.score.away;
      a.gf += m.score.away; a.ga += m.score.home;
      if (m.score.home > m.score.away) { h.w++; h.pts += 3; a.l++; }
      else if (m.score.home < m.score.away) { a.w++; a.pts += 3; h.l++; }
      else { h.d++; h.pts++; a.d++; a.pts++; }
    }
  }

  const letters = [...new Set(groupMatches.map(m => m.groupLetter).filter(Boolean))].sort();

  if (letters.length === 0) {
    return (
      <div className="py-12 text-center" style={{ color: C.muted }}>
        Group stage data not yet available. Add your Firebase + football-data.org API keys to load live match data.
      </div>
    );
  }

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {letters.map(letter => (
        <GroupTable key={letter} letter={letter} teams={groups[letter] || {}} />
      ))}
    </div>
  );
}

function GroupTable({ letter, teams }) {
  const rows = Object.entries(teams)
    .map(([code, s]) => ({ code, ...s }))
    .sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga));

  return (
    <div className="card-lg overflow-hidden">
      <div className="px-4 py-3" style={{ background: C.navy }}>
        <div className="font-display text-lg text-white" style={{ fontWeight: 700 }}>Group {letter}</div>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr style={{ borderBottom: `1px solid ${C.border}` }}>
            <th className="text-left px-4 py-2 font-semibold text-xs uppercase tracking-widest" style={{ color: C.muted }}>Team</th>
            <th className="px-2 py-2 font-semibold text-xs" style={{ color: C.muted }}>W</th>
            <th className="px-2 py-2 font-semibold text-xs" style={{ color: C.muted }}>D</th>
            <th className="px-2 py-2 font-semibold text-xs" style={{ color: C.muted }}>L</th>
            <th className="px-2 py-2 font-semibold text-xs" style={{ color: C.muted }}>Pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const team = teamByCode[r.code];
            return (
              <tr key={r.code} style={{ background: i < 2 ? 'rgba(30,58,111,0.04)' : 'transparent', borderBottom: `1px solid ${C.border}` }}>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{team?.flag}</span>
                    <span className="font-semibold text-sm">{team?.name}</span>
                    {i < 2 && <span className="text-[9px] px-1.5 py-0.5 rounded font-bold" style={{ background: 'rgba(30,58,111,0.1)', color: C.navy }}>ADV</span>}
                  </div>
                </td>
                <td className="px-2 py-2 text-center font-mono text-sm">{r.w}</td>
                <td className="px-2 py-2 text-center font-mono text-sm">{r.d}</td>
                <td className="px-2 py-2 text-center font-mono text-sm">{r.l}</td>
                <td className="px-2 py-2 text-center font-bold font-mono">{r.pts}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
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
          return (
            <div key={round} className="flex flex-col gap-4" style={{ minWidth: 220 }}>
              <div className="text-xs uppercase tracking-widest font-semibold text-center" style={{ color: C.muted }}>
                {ROUND_LABELS[round]}
              </div>
              {roundMatches.map(m => (
                <KnockoutCard key={m.id} match={m} isFinal={round === 'final'} />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function KnockoutCard({ match, isFinal }) {
  const home = teamByCode[match.homeTeam];
  const away = teamByCode[match.awayTeam];
  const homeWon = match.score && match.score.home > match.score.away;
  const awayWon = match.score && match.score.away > match.score.home;

  return (
    <div className="card-lg overflow-hidden"
      style={{ border: isFinal ? `2px solid ${C.gold}` : undefined }}>
      {isFinal && (
        <div className="px-4 py-2 text-center text-xs font-bold uppercase tracking-widest" style={{ background: C.gold, color: 'white' }}>
          ★ Final
        </div>
      )}
      <div className="p-3 space-y-1.5">
        <KnockoutTeamRow team={home} score={match.score?.home} won={homeWon} />
        <div className="h-px" style={{ background: C.border }} />
        <KnockoutTeamRow team={away} score={match.score?.away} won={awayWon} />
      </div>
    </div>
  );
}

function KnockoutTeamRow({ team, score, won }) {
  return (
    <div className="flex items-center gap-2 py-0.5" style={{ opacity: won === false ? 0.4 : 1 }}>
      <span className="text-xl">{team?.flag || '?'}</span>
      <span className="flex-1 font-semibold text-sm">{team?.name || 'TBD'}</span>
      {score !== undefined && (
        <span className="font-bold font-mono" style={{ color: won ? C.navy : C.muted }}>{score}</span>
      )}
    </div>
  );
}
