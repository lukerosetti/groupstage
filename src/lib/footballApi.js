const BASE = 'https://api.football-data.org/v4';
const KEY = import.meta.env.VITE_FOOTBALL_DATA_KEY;

async function apiFetch(path) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'X-Auth-Token': KEY },
  });
  if (!res.ok) throw new Error(`football-data.org ${res.status}: ${path}`);
  return res.json();
}

export async function fetchAllMatches() {
  const data = await apiFetch('/competitions/WC/matches');
  return data.matches || [];
}

export async function fetchMatch(id) {
  return apiFetch(`/matches/${id}`);
}

export async function fetchCompetitionTeams() {
  const data = await apiFetch('/competitions/WC/teams');
  return data.teams || [];
}

// Map API match status to our internal status
export function normalizeStatus(apiStatus) {
  if (['SCHEDULED', 'TIMED'].includes(apiStatus)) return 'scheduled';
  if (['IN_PLAY', 'PAUSED'].includes(apiStatus)) return 'live';
  if (['FINISHED'].includes(apiStatus)) return 'completed';
  return 'scheduled';
}

// Map API round to our round codes
export function normalizeRound(stage) {
  const map = {
    'GROUP_STAGE': 'group',
    'ROUND_OF_32': 'r32',
    'ROUND_OF_16': 'r16',
    'QUARTER_FINALS': 'qf',
    'SEMI_FINALS': 'sf',
    'FINAL': 'final',
  };
  return map[stage] || 'group';
}
