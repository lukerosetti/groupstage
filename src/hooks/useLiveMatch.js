import { useState, useEffect, useRef } from 'react';
import { fetchLineups, fetchEvents, fetchFixtureStats } from '../lib/apiFootball';

export function useLiveMatch(fixtureId, isLive) {
  const [lineups, setLineups] = useState(null);
  const [events, setEvents] = useState([]);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);
  const intervalRef = useRef(null);

  async function refresh() {
    try {
      const [l, e, s] = await Promise.all([
        fetchLineups(fixtureId),
        fetchEvents(fixtureId),
        fetchFixtureStats(fixtureId),
      ]);
      setLineups(l);
      setEvents(e);
      setStats(s);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    if (!fixtureId) return;
    refresh();
    if (isLive) {
      intervalRef.current = setInterval(refresh, 30000);
    }
    return () => clearInterval(intervalRef.current);
  }, [fixtureId, isLive]);

  return { lineups, events, stats, error };
}
