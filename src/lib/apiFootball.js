const BASE = 'https://v3.football.api-sports.io';
const KEY  = import.meta.env.VITE_API_FOOTBALL_KEY;

// 2026 FIFA World Cup — league ID 1, season 2026
const WC_LEAGUE  = 1;
const WC_SEASON  = 2026;

async function apiFetch(path) {
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      'x-apisports-key': KEY,
    },
  });
  if (!res.ok) throw new Error(`api-football ${res.status}: ${path}`);
  const json = await res.json();
  return json.response || [];
}

export async function fetchLineups(fixtureId) {
  return apiFetch(`/fixtures/lineups?fixture=${fixtureId}`);
}

export async function fetchEvents(fixtureId) {
  return apiFetch(`/fixtures/events?fixture=${fixtureId}`);
}

export async function fetchFixtureStats(fixtureId) {
  return apiFetch(`/fixtures/statistics?fixture=${fixtureId}`);
}

export async function fetchLiveFixtures() {
  return apiFetch(`/fixtures?league=${WC_LEAGUE}&season=${WC_SEASON}&live=all`);
}

export async function fetchSquad(teamId) {
  return apiFetch(`/players/squads?team=${teamId}`);
}

export async function fetchFixtureById(fixtureId) {
  const data = await apiFetch(`/fixtures?id=${fixtureId}`);
  return data[0] || null;
}
