/**
 * Scoring rules:
 *  Group stage   — Win: 3 pts  |  Draw: 1 pt  |  Loss: 0 pts
 *  Knockout wins — R32 / R16 / QF / SF: 4 pts each
 *  World Cup Final win — 5 pts
 *  Third-place game win — 0 pts (no points awarded)
 */

export const POINTS = {
  groupWin:  3,
  groupDraw: 1,
  koWin:     4,   // r32, r16, qf, sf
  finalWin:  5,
  thirdWin:  0,
};

export function calcTeamPoints(stats) {
  if (!stats) return 0;
  return (
    (stats.groupWins  || 0) * POINTS.groupWin  +
    (stats.groupDraws || 0) * POINTS.groupDraw +
    (stats.r32Win  ? POINTS.koWin   : 0) +
    (stats.r16Win  ? POINTS.koWin   : 0) +
    (stats.qfWin   ? POINTS.koWin   : 0) +
    (stats.sfWin   ? POINTS.koWin   : 0) +
    (stats.finalWin ? POINTS.finalWin : 0)
    // thirdWin intentionally omitted — 0 pts
  );
}

export function calcMemberPoints(memberTeams, matchResults) {
  let total = 0;
  const breakdown = {};
  for (const code of memberTeams) {
    const stats = deriveTeamStats(code, matchResults);
    const pts   = calcTeamPoints(stats);
    breakdown[code] = { pts, stats };
    total += pts;
  }
  return { total, breakdown };
}

export function deriveTeamStats(teamCode, matches) {
  const stats = {
    groupWins:  0,
    groupDraws: 0,
    groupLosses: 0,
    r32Win:  false,
    r16Win:  false,
    qfWin:   false,
    sfWin:   false,
    finalWin: false,
    thirdWin: false,
  };
  if (!matches) return stats;

  for (const m of matches) {
    const isHome = m.homeTeam === teamCode;
    const isAway = m.awayTeam === teamCode;
    if (!isHome && !isAway) continue;
    if (m.status !== 'completed' || !m.score) continue;

    const myScore    = isHome ? m.score.home : m.score.away;
    const theirScore = isHome ? m.score.away : m.score.home;
    if (myScore == null || theirScore == null) continue;

    const won  = myScore > theirScore;
    const drew = myScore === theirScore;

    // For knockout rounds, a match decided by penalty shootout has a level
    // fullTime score. Use m.winner (canonical team code set by sync daemon)
    // to correctly credit the shootout winner with the 4/5 pts.
    const wonKnockout = won || (drew && m.winner === teamCode);

    if (m.round === 'group') {
      if (won)       stats.groupWins++;
      else if (drew) stats.groupDraws++;
      else           stats.groupLosses++;
    } else if (m.round === 'third') {
      if (wonKnockout) stats.thirdWin = true; // 0 pts but tracked for display
    } else if (wonKnockout) {
      // knockout win (including penalty shootout deciders)
      if (m.round === 'r32')   stats.r32Win   = true;
      if (m.round === 'r16')   stats.r16Win   = true;
      if (m.round === 'qf')    stats.qfWin    = true;
      if (m.round === 'sf')    stats.sfWin    = true;
      if (m.round === 'final') stats.finalWin = true;
    }
  }

  return stats;
}
