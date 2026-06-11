import { useState, useEffect, useCallback } from 'react';
import {
  doc, onSnapshot, setDoc, updateDoc, runTransaction,
  serverTimestamp, Timestamp, deleteDoc, writeBatch,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { TEAMS } from '../lib/teams';

/** Build a full snake-order array of memberIds, length = totalPicks */
function buildSnakeOrder(memberIds, totalPicks) {
  const n = memberIds.length;
  const order = [];
  for (let i = 0; i < totalPicks; i++) {
    const round = Math.floor(i / n);
    const slot  = i % n;
    const pos   = round % 2 === 0 ? slot : n - 1 - slot;
    order.push(memberIds[pos]);
  }
  return order;
}

function genCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export function useDraft(poolId) {
  const [draft, setDraft]   = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!poolId) return;
    const ref = doc(db, 'pools', poolId, 'drafts', 'current');
    const unsub = onSnapshot(ref, snap => {
      setDraft(snap.exists() ? { id: snap.id, ...snap.data() } : null);
      setLoading(false);
    });
    return unsub;
  }, [poolId]);

  /** Create (or re-create) a draft lobby */
  const initDraft = useCallback(async (members, timerSec = 90) => {
    const memberIds      = members.map(m => m.id);
    const availableTeams = TEAMS.map(t => t.code);
    const teamsPerMember = Math.floor(availableTeams.length / members.length);
    const totalPicks     = members.length * teamsPerMember;
    const order          = buildSnakeOrder(memberIds, totalPicks);

    await setDoc(doc(db, 'pools', poolId, 'drafts', 'current'), {
      status: 'lobby',
      members: members.map(m => ({ id: m.id, name: m.name, color: m.color })),
      order,
      teamsPerMember,
      totalPicks,
      currentPickIndex: 0,
      picks: [],
      availableTeams,
      timerSec,
      pickDeadline: null,
      joinCode: genCode(),
      createdAt: serverTimestamp(),
      startedAt: null,
      presence: {},
    });
  }, [poolId]);

  /** Move lobby → picking */
  const startDraft = useCallback(async (timerSec) => {
    const deadline = Timestamp.fromDate(new Date(Date.now() + timerSec * 1000));
    await updateDoc(doc(db, 'pools', poolId, 'drafts', 'current'), {
      status: 'picking',
      startedAt: serverTimestamp(),
      pickDeadline: deadline,
      timerSec,
    });
  }, [poolId]);

  /** Member picks a team — Firestore transaction prevents double-picks */
  const makePick = useCallback(async (teamCode, memberId) => {
    const ref = doc(db, 'pools', poolId, 'drafts', 'current');
    await runTransaction(db, async tx => {
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error('Draft not found');
      const d = snap.data();
      if (d.status !== 'picking') throw new Error('Draft not active');
      if (d.order[d.currentPickIndex] !== memberId) throw new Error('Not your turn');
      if (!d.availableTeams.includes(teamCode)) throw new Error('Team not available');

      const newPicks     = [...d.picks, { memberId, teamCode, pickNum: d.currentPickIndex }];
      const newAvailable = d.availableTeams.filter(c => c !== teamCode);
      const newIndex     = d.currentPickIndex + 1;
      const isDone       = newIndex >= d.totalPicks;
      const newDeadline  = isDone
        ? null
        : Timestamp.fromDate(new Date(Date.now() + d.timerSec * 1000));

      tx.update(ref, {
        picks: newPicks,
        availableTeams: newAvailable,
        currentPickIndex: newIndex,
        status: isDone ? 'complete' : 'picking',
        pickDeadline: newDeadline,
      });
    });
  }, [poolId]);

  /**
   * Auto-advance when timer expires — any connected client may call this.
   * The transaction ensures only one succeeds (race condition safe).
   */
  const autoAdvance = useCallback(async (expectedIndex) => {
    const ref = doc(db, 'pools', poolId, 'drafts', 'current');
    try {
      await runTransaction(db, async tx => {
        const snap = await tx.get(ref);
        if (!snap.exists()) return;
        const d = snap.data();
        // Guard: another client may have already advanced
        if (d.currentPickIndex !== expectedIndex) return;
        if (d.status !== 'picking') return;
        const deadline = d.pickDeadline?.toDate ? d.pickDeadline.toDate() : new Date(d.pickDeadline);
        if (deadline > new Date()) return;

        // Random pick from remaining teams
        const teamCode   = d.availableTeams[Math.floor(Math.random() * d.availableTeams.length)];
        const memberId   = d.order[d.currentPickIndex];
        const newPicks   = [...d.picks, { memberId, teamCode, pickNum: d.currentPickIndex, auto: true }];
        const newAvail   = d.availableTeams.filter(c => c !== teamCode);
        const newIndex   = d.currentPickIndex + 1;
        const isDone     = newIndex >= d.totalPicks;
        const newDeadline = isDone
          ? null
          : Timestamp.fromDate(new Date(Date.now() + d.timerSec * 1000));

        tx.update(ref, {
          picks: newPicks,
          availableTeams: newAvail,
          currentPickIndex: newIndex,
          status: isDone ? 'complete' : 'picking',
          pickDeadline: newDeadline,
        });
      });
    } catch { /* another client already advanced — safe to ignore */ }
  }, [poolId]);

  /** Heartbeat presence — call every 15s per connected member */
  const updatePresence = useCallback(async (memberId) => {
    if (!memberId) return;
    try {
      await updateDoc(doc(db, 'pools', poolId, 'drafts', 'current'), {
        [`presence.${memberId}`]: Date.now(),
      });
    } catch { /* draft not initialised yet */ }
  }, [poolId]);

  /** Write draft results → member docs + set pool status active */
  const finalizeDraft = useCallback(async (picks) => {
    const teamsByMember = {};
    for (const pick of picks) {
      if (!teamsByMember[pick.memberId]) teamsByMember[pick.memberId] = [];
      teamsByMember[pick.memberId].push(pick.teamCode);
    }
    const batch = writeBatch(db);
    for (const [memberId, teams] of Object.entries(teamsByMember)) {
      batch.update(doc(db, 'pools', poolId, 'members', memberId), {
        teams,
        draftedAt: serverTimestamp(),
      });
    }
    batch.update(doc(db, 'pools', poolId), { status: 'active' });
    batch.update(doc(db, 'pools', poolId, 'drafts', 'current'), { status: 'finalized' });
    await batch.commit();
  }, [poolId]);

  /** Delete draft document entirely (commissioner reset) */
  const resetDraft = useCallback(async () => {
    await deleteDoc(doc(db, 'pools', poolId, 'drafts', 'current'));
  }, [poolId]);

  return { draft, loading, initDraft, startDraft, makePick, autoAdvance, updatePresence, finalizeDraft, resetDraft };
}
