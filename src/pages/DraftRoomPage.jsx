import { Link, useParams } from 'react-router-dom';
import { usePool } from '../hooks/usePool';
import useLocalUser from '../hooks/useLocalUser';
import { useDraft } from '../hooks/useDraft';
import { C } from '../lib/colors';
import DraftLobby    from '../components/draft/DraftLobby';
import DraftBoard    from '../components/draft/DraftBoard';
import DraftComplete from '../components/draft/DraftComplete';

export default function DraftRoomPage() {
  const { id } = useParams();
  const { pool, members, loading }                                   = usePool(id);
  const { user }                                                     = useLocalUser();
  const {
    draft, loading: draftLoading,
    initDraft, startDraft, makePick,
    autoAdvance, updatePresence,
    finalizeDraft, resetDraft,
  } = useDraft(id);

  if (loading || draftLoading) {
    return (
      <div className="px-6 py-20 text-center" style={{ color: C.muted }}>
        Loading draft room…
      </div>
    );
  }

  if (!pool) return null;

  const commEmail     = pool.commissionerEmail || pool.creatorEmail;
  const isCommissioner = !!(user?.email && commEmail && user.email === commEmail);
  const myMember      = members.find(m => m.email === user?.email);

  // Gate: must be a pool member
  if (!myMember) {
    return (
      <div className="px-6 py-20 text-center max-w-md mx-auto">
        <div className="text-4xl mb-4">🔒</div>
        <div className="font-display text-xl mb-2" style={{ fontWeight: 700 }}>
          You're not in this pool
        </div>
        <div className="text-sm mb-6" style={{ color: C.muted }}>
          Only pool members can participate in the draft.
        </div>
        <Link to={`/p/${id}/join`}
          className="text-sm font-semibold no-underline"
          style={{ color: C.navy }}>
          Join the pool →
        </Link>
      </div>
    );
  }

  // Route to the right view based on draft status
  const status = draft?.status;

  if (!draft || status === 'lobby') {
    return (
      <DraftLobby
        pool={pool}
        members={members}
        draft={draft}
        poolId={id}
        isCommissioner={isCommissioner}
        myMember={myMember}
        onInit={initDraft}
        onStart={startDraft}
        onReset={resetDraft}
        onPresence={updatePresence}
      />
    );
  }

  if (status === 'complete' || status === 'finalized') {
    return (
      <DraftComplete
        draft={draft}
        pool={pool}
        poolId={id}
        isCommissioner={isCommissioner}
        onFinalize={finalizeDraft}
        onReset={resetDraft}
      />
    );
  }

  // status === 'picking'
  return (
    <DraftBoard
      draft={draft}
      pool={pool}
      poolId={id}
      myMember={myMember}
      isCommissioner={isCommissioner}
      onPick={makePick}
      onAutoAdvance={autoAdvance}
      onPresence={updatePresence}
    />
  );
}
