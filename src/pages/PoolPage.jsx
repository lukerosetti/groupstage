import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Share2, Copy, Check, ArrowUpRight } from 'lucide-react';
import { C } from '../lib/colors';
import { usePool } from '../hooks/usePool';
import { useMatches } from '../hooks/useMatches';
import useLocalUser from '../hooks/useLocalUser';
import { teamByCode, TEAMS } from '../lib/teams';
import { calcMemberPoints } from '../lib/scoring';
import { format, isToday } from 'date-fns';
import OverviewTab from '../components/pool/OverviewTab';
import BracketTab from '../components/bracket/BracketTab';
import ScheduleTab from '../components/schedule/ScheduleTab';
import TeamsTab from '../components/teams/TeamsTab';
import StandingsTab from '../components/pool/StandingsTab';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'bracket', label: 'Bracket' },
  { id: 'schedule', label: 'Schedule' },
  { id: 'teams', label: 'Teams' },
  { id: 'standings', label: 'Standings' },
];

export default function PoolPage() {
  const { id } = useParams();
  const { pool, members, loading, error } = usePool(id);
  const { matches } = useMatches();
  const { user } = useLocalUser();
  const [activeTab, setActiveTab] = useState('overview');

  if (loading) return <div className="px-6 py-20 text-center" style={{ color: C.muted }}>Loading pool…</div>;
  if (error) return <div className="px-6 py-20 text-center" style={{ color: C.red }}>{error}</div>;
  if (!pool) return null;

  const inviteUrl = `${window.location.origin}/p/${id}/join`;

  return (
    <div>
      {/* Pool header */}
      <div className="px-6 pt-8 pb-0 max-w-7xl mx-auto">
        <div className="flex items-end justify-between flex-wrap gap-4 mb-6">
          <div>
            <div className="text-xs uppercase tracking-widest font-semibold mb-1" style={{ color: C.muted }}>
              {members.length} of {pool.memberCount} members joined
            </div>
            <h1 className="font-display text-4xl" style={{ fontWeight: 800 }}>{pool.name}</h1>
          </div>
          <div className="flex items-center gap-3">
            <CopyInvite url={inviteUrl} />
            <Link to={`/p/${id}/join`}
              className="px-4 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-1.5 no-underline"
              style={{ background: C.navy, color: 'white' }}>
              Invite <ArrowUpRight size={14} />
            </Link>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex overflow-x-auto scrollbar-hide gap-1 -mb-px">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className="px-4 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors"
              style={{
                color: activeTab === t.id ? C.navy : C.muted,
                borderColor: activeTab === t.id ? C.navy : 'transparent',
              }}>
              {t.label}
            </button>
          ))}
        </div>
        <div style={{ borderBottom: `1px solid ${C.border}` }} />
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {activeTab === 'overview' && <OverviewTab pool={pool} members={members} matches={matches} poolId={id} inviteUrl={inviteUrl} />}
        {activeTab === 'bracket' && <BracketTab matches={matches} />}
        {activeTab === 'schedule' && <ScheduleTab matches={matches} members={members} />}
        {activeTab === 'teams' && <TeamsTab />}
        {activeTab === 'standings' && <StandingsTab members={members} matches={matches} pool={pool} />}
      </div>
    </div>
  );
}

function CopyInvite({ url }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <button onClick={copy} className="card px-4 py-2.5 text-sm font-semibold flex items-center gap-2">
      {copied ? <Check size={14} style={{ color: C.green }} /> : <Copy size={14} style={{ color: C.muted }} />}
      {copied ? 'Copied!' : 'Copy invite'}
    </button>
  );
}
