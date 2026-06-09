export const POINTS = {
  goal: 2,
  win: 5,
  cleanSheet: 3,
  groupAdvance: 10,
  r32Win: 15,
  r16Win: 20,
  qfWin: 30,
  sfWin: 50,
  finalWin: 100,
};

export function calcTeamPoints(teamStats) {
  if (!teamStats) return 0;
  return (
    (teamStats.goals || 0) * POINTS.goal +
    (teamStats.wins || 0) * POINTS.win +
    (teamStats.cleanSheets || 0) * POINTS.cleanSheet +
    (teamStats.groupAdvanced ? POINTS.groupAdvance : 0) +
    (teamStats.r32Win ? POINTS.r32Win : 0) +
    (teamStats.r16Win ? POINTS.r16Win : 0) +
    (teamStats.qfWin ? POINTS.qfWin : 0) +
    (teamStats.sfWin ? POINTS.sfWin : 0) +
    (teamStats.finalWin ? POINTS.finalWin : 0)
  );
}

export function calcMemberPoints(memberTeams, matchResults) {
  let total = 0;
  const breakdown = {};
  for (const code of memberTeams) {
    const stats = deriveTeamStats(code, matchResults);
    const pts = calcTeamPoints(stats);
    breakdown[code] = { pts, stats };
    total += pts;
  }
  return { total, breakdown };
}

export function deriveTeamStats(teamCode, matches) {
  const stats = {
    goals: 0, wins: 0, cleanSheets: 0,
    groupAdvanced: false, r32Win: false, r16Win: false, qfWin: false, sfWin: false, finalWin: false,
  };
  if (!matches) return stats;

  for (const m of matches) {
    if (m.status !== 'completed' || !m.score) continue;
    const isHome = m.homeTeam === teamCode;
    const isAway = m.awayTeam === teamCode;
    if (!isHome && !isAway) continue;

    const myScore = isHome ? m.score.home : m.score.away;
    const theirScore = isHome ? m.score.away : m.score.home;
    stats.goals += myScore;
    if (myScore > theirScore) {
      stats.wins++;
      if (theirScore === 0) stats.cleanSheets++;
      if (m.round === 'r32') stats.r32Win = true;
      if (m.round === 'r16') stats.r16Win = true;
      if (m.round === 'qf') stats.qfWin = true;
      if (m.round === 'sf') stats.sfWin = true;
      if (m.round === 'final') stats.finalWin = true;
    }
    if (myScore === 0 && theirScore > 0) {
      // lost but check clean sheet for the winner — N/A here
    }
  }
  return stats;
}
