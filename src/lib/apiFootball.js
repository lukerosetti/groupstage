const BASE = 'https://api-football-v1.p.rapidapi.com/v3';
const KEY = import.meta.env.VITE_API_FOOTBALL_KEY;

async function apiFetch(path) {
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      'x-rapidapi-key': KEY,
      'x-rapidapi-host': 'api-football-v1.p.rapidapi.com',
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

export async function fetchSquad(teamId) {
  return apiFetch(`/players/squads?team=${teamId}`);
}
