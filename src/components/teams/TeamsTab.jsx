import { useState } from 'react';
import { C } from '../../lib/colors';
import { TEAMS, teamByCode } from '../../lib/teams';
import Modal from '../ui/Modal';
import { fetchSquad } from '../../lib/apiFootball';

const CONFS = ['All', 'UEFA', 'CONMEBOL', 'CONCACAF', 'AFC', 'CAF', 'OFC'];

export default function TeamsTab({ members = [] }) {
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [selectedTeam, setSelectedTeam] = useState(null);

  // Build teamCode → owner map
  const ownerByTeam = {};
  for (const m of members) {
    for (const code of (m.teams || [])) ownerByTeam[code] = m;
  }

  const filtered = TEAMS.filter(t => {
    const matchesConf = filter === 'All' || t.conf === filter;
    const matchesSearch = !search || t.name.toLowerCase().includes(search.toLowerCase());
    return matchesConf && matchesSearch;
  });

  return (
    <div>
      <div className="flex gap-4 items-center mb-5 flex-wrap">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search teams…"
          className="card px-4 py-2.5 text-sm outline-none rounded-lg"
          style={{ minWidth: 200 }} />
        <div className="flex gap-2 flex-wrap">
          {CONFS.map(c => (
            <button key={c} onClick={() => setFilter(c)}
              className="px-3 py-1.5 rounded-full text-xs font-semibold"
              style={{
                background: filter === c ? C.ink : C.card,
                color: filter === c ? 'white' : C.ink,
                border: `1px solid ${filter === c ? C.ink : C.border}`,
              }}>
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {filtered.map(t => {
          const owner = ownerByTeam[t.code];
          return (
            <button key={t.code} onClick={() => setSelectedTeam(t)}
              className="card text-left p-4 rounded-xl hover:-translate-y-0.5 transition-transform relative"
              style={{ borderColor: owner ? owner.color : undefined, borderWidth: owner ? 2 : 1 }}>
              {owner && (
                <div className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full" style={{ background: owner.color }} title={owner.name} />
              )}
              <div className="text-3xl mb-2">{t.flag}</div>
              <div className="font-semibold text-sm">{t.name}</div>
              <div className="text-[10px] mt-1 font-mono" style={{ color: C.muted }}>{t.conf} · #{t.rank}</div>
              {owner && (
                <div className="text-[10px] mt-1 font-semibold truncate" style={{ color: owner.color }}>{owner.name.split(' ')[0]}</div>
              )}
            </button>
          );
        })}
      </div>

      <Modal open={!!selectedTeam} onClose={() => setSelectedTeam(null)} title={selectedTeam?.name}>
        {selectedTeam && <TeamModalContent team={selectedTeam} />}
      </Modal>
    </div>
  );
}

function TeamModalContent({ team }) {
  const [squad, setSquad] = useState(null);
  const [squadLoading, setSquadLoading] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState(null);

  async function loadSquad() {
    if (squad || squadLoading) return;
    setSquadLoading(true);
    try {
      const data = await fetchSquad(team.apiId);
      setSquad(data?.[0]?.players || []);
    } catch {
      setSquad([]);
    } finally {
      setSquadLoading(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <div className="text-6xl">{team.flag}</div>
        <div>
          <div className="font-display text-3xl" style={{ fontWeight: 700 }}>{team.name}</div>
          <div className="text-sm mt-1" style={{ color: C.muted }}>{team.conf} · FIFA #{team.rank}</div>
        </div>
      </div>

      <div className="mb-4">
        <button onClick={loadSquad} className="text-sm font-semibold" style={{ color: C.navy }}>
          {squadLoading ? 'Loading squad…' : squad ? null : 'Load squad →'}
        </button>
        {squad !== null && squad.length === 0 && (
          <div className="text-sm" style={{ color: C.muted }}>Squad data not available (API key required).</div>
        )}
        {squad && squad.length > 0 && (
          <div className="grid grid-cols-2 gap-2 mt-3">
            {squad.map(p => (
              <button key={p.id} onClick={() => setSelectedPlayer(p)}
                className="text-left p-3 rounded-lg flex items-center gap-2"
                style={{ background: C.bg }}>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">{p.name}</div>
                  <div className="text-xs" style={{ color: C.muted }}>{p.position}</div>
                </div>
                <div className="text-xs font-mono" style={{ color: C.muted }}>#{p.number}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedPlayer && (
        <div className="card-lg p-4 mt-4">
          <div className="flex items-center justify-between mb-2">
            <div className="font-display text-lg" style={{ fontWeight: 700 }}>{selectedPlayer.name}</div>
            <button onClick={() => setSelectedPlayer(null)} className="text-sm" style={{ color: C.muted }}>✕</button>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span style={{ color: C.muted }}>Position</span><div className="font-semibold">{selectedPlayer.position || '—'}</div></div>
            <div><span style={{ color: C.muted }}>Age</span><div className="font-semibold">{selectedPlayer.age || '—'}</div></div>
          </div>
        </div>
      )}
    </div>
  );
}
