/**
 * Firestore security rules tests.
 *
 * Requires the Firebase emulator suite running locally:
 *   firebase emulators:start --only firestore
 *
 * Run tests:
 *   npx vitest run tests/rules/firestore-rules.test.js
 *
 * The Admin SDK always bypasses rules (tested implicitly — if these client-
 * blocked writes were attempted by the daemon they would succeed; that cannot
 * be demonstrated here without a real service account, but the behaviour is
 * documented in Firebase's SDK contract).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  doc, setDoc, updateDoc, deleteDoc,
  collection, addDoc,
} from 'firebase/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RULES_PATH = resolve(__dirname, '../../firestore.rules');

let testEnv;

// ── Setup / teardown ────────────────────────────────────────────────────────

beforeAll(async () => {
  // demo- prefix: emulator accepts it without any real Firebase credentials
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-groupstage-test',
    firestore: {
      rules: readFileSync(RULES_PATH, 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

/** Returns an unauthenticated client Firestore instance */
function clientDb() {
  return testEnv.unauthenticatedContext().firestore();
}

/** Returns an admin (rule-bypassing) Firestore instance */
function adminDb() {
  return testEnv.withSecurityRulesDisabled(ctx => ctx.firestore());
}

// ── Seed helpers ─────────────────────────────────────────────────────────────

async function seedPool(poolId, data = {}) {
  await testEnv.withSecurityRulesDisabled(async ctx => {
    await setDoc(doc(ctx.firestore(), 'pools', poolId), {
      name: 'Test Pool',
      status: 'lobby',
      createdAt: new Date(),
      ...data,
    });
  });
}

async function seedMember(poolId, memberId, data = {}) {
  await testEnv.withSecurityRulesDisabled(async ctx => {
    await setDoc(doc(ctx.firestore(), 'pools', poolId, 'members', memberId), {
      name: 'Alice',
      email: 'alice@example.com',
      status: 'joined',
      teams: [],
      ...data,
    });
  });
}

async function seedDraft(poolId, draftData = {}) {
  await testEnv.withSecurityRulesDisabled(async ctx => {
    await setDoc(doc(ctx.firestore(), 'pools', poolId, 'drafts', 'current'), {
      status: 'picking',
      picks: [],
      availableTeams: ['ENG', 'FRA', 'BRA'],
      currentPickIndex: 0,
      order: ['m1', 'm2'],
      totalPicks: 6,
      timerSec: 90,
      pickDeadline: null,
      presence: {},
      ...draftData,
    });
  });
}

// ── ITEM 5 — Client cannot write a score ─────────────────────────────────────

describe('matches collection', () => {
  it('client can READ a match document', async () => {
    await testEnv.withSecurityRulesDisabled(async ctx => {
      await setDoc(doc(ctx.firestore(), 'matches', 'm1'), { homeTeam: 'ENG', status: 'scheduled' });
    });
    await assertSucceeds(
      doc(clientDb(), 'matches', 'm1').firestore.collection
        ? clientDb().doc('matches/m1').get()
        : clientDb().collection('matches').doc('m1').get?.() ??
          clientDb().collection('matches').get()
    );
  });

  it('client CANNOT write to matches (score injection)', async () => {
    await assertFails(
      setDoc(doc(clientDb(), 'matches', 'injected'), {
        homeTeam: 'ENG',
        awayTeam: 'FRA',
        score: { home: 99, away: 0 },
        status: 'completed',
      })
    );
  });

  it('client CANNOT update an existing match score', async () => {
    await testEnv.withSecurityRulesDisabled(async ctx => {
      await setDoc(doc(ctx.firestore(), 'matches', 'existing'), {
        homeTeam: 'ENG', awayTeam: 'FRA', status: 'live', score: null,
      });
    });
    await assertFails(
      updateDoc(doc(clientDb(), 'matches', 'existing'), {
        score: { home: 2, away: 1 },
        status: 'completed',
      })
    );
  });
});

// ── ITEM 5 — Pool and member docs reject sync fields ─────────────────────────

describe('pools collection — field validation', () => {
  it('client CAN create a valid pool', async () => {
    await assertSucceeds(
      setDoc(doc(clientDb(), 'pools', 'newpool1'), {
        name: 'Friends Pool',
        status: 'lobby',
        createdAt: new Date(),
      })
    );
  });

  it('client CANNOT inject "score" into a pool doc', async () => {
    await assertFails(
      setDoc(doc(clientDb(), 'pools', 'badpool1'), {
        name: 'Cheat Pool',
        score: { home: 10, away: 0 },
      })
    );
  });

  it('client CANNOT inject "winner" into a pool doc', async () => {
    await assertFails(
      setDoc(doc(clientDb(), 'pools', 'badpool2'), {
        name: 'Cheat Pool',
        winner: 'ENG',
      })
    );
  });

  it('client CANNOT inject "externalId" (sync-only field) into a pool doc', async () => {
    await assertFails(
      setDoc(doc(clientDb(), 'pools', 'badpool3'), {
        name: 'Cheat Pool',
        externalId: 12345,
      })
    );
  });
});

describe('members collection — field validation', () => {
  beforeAll(() => seedPool('pool-members-test'));

  it('client CAN create a valid member', async () => {
    await assertSucceeds(
      setDoc(doc(clientDb(), 'pools', 'pool-members-test', 'members', 'mem1'), {
        name: 'Bob',
        email: 'bob@example.com',
        status: 'invited',
        teams: [],
        color: '#123456',
      })
    );
  });

  it('client CANNOT inject "points" into a member doc', async () => {
    await assertFails(
      setDoc(doc(clientDb(), 'pools', 'pool-members-test', 'members', 'cheat1'), {
        name: 'Cheater',
        points: 9999,
      })
    );
  });

  it('client CANNOT inject "score" into a member doc', async () => {
    await assertFails(
      setDoc(doc(clientDb(), 'pools', 'pool-members-test', 'members', 'cheat2'), {
        name: 'Cheater',
        score: { home: 5, away: 0 },
      })
    );
  });

  it('client CANNOT inject "winner" into a member doc', async () => {
    await assertFails(
      setDoc(doc(clientDb(), 'pools', 'pool-members-test', 'members', 'cheat3'), {
        name: 'Cheater',
        winner: 'ENG',
      })
    );
  });

  it('client CAN update member email (legitimate operation)', async () => {
    await seedMember('pool-members-test', 'mem-email');
    await assertSucceeds(
      updateDoc(doc(clientDb(), 'pools', 'pool-members-test', 'members', 'mem-email'), {
        email: 'newemail@example.com',
      })
    );
  });
});

// ── ITEM 5 — Finalized draft is immutable (picks and team lists locked) ───────

describe('drafts — finalized draft protection', () => {
  it('client CAN make a pick while draft is "picking"', async () => {
    await seedPool('pool-draft-test');
    await seedDraft('pool-draft-test', { status: 'picking', currentPickIndex: 0 });
    await assertSucceeds(
      updateDoc(doc(clientDb(), 'pools', 'pool-draft-test', 'drafts', 'current'), {
        picks: [{ memberId: 'm1', teamCode: 'ENG', pickNum: 0 }],
        availableTeams: ['FRA', 'BRA'],
        currentPickIndex: 1,
      })
    );
  });

  it('client CAN transition draft from "complete" → "finalized"', async () => {
    await seedPool('pool-draft-finalize');
    await seedDraft('pool-draft-finalize', {
      status: 'complete',
      picks: [{ memberId: 'm1', teamCode: 'ENG', pickNum: 0 }],
    });
    await assertSucceeds(
      updateDoc(doc(clientDb(), 'pools', 'pool-draft-finalize', 'drafts', 'current'), {
        status: 'finalized',
      })
    );
  });

  it('client CANNOT overwrite picks once draft is "finalized"', async () => {
    await seedPool('pool-draft-immutable');
    await seedDraft('pool-draft-immutable', {
      status: 'finalized',
      picks: [{ memberId: 'm1', teamCode: 'ENG', pickNum: 0 }],
    });
    await assertFails(
      updateDoc(doc(clientDb(), 'pools', 'pool-draft-immutable', 'drafts', 'current'), {
        picks: [{ memberId: 'm1', teamCode: 'ARG', pickNum: 0 }], // retroactive change
      })
    );
  });

  it('client CANNOT change availableTeams once draft is "finalized"', async () => {
    await seedPool('pool-draft-avail');
    await seedDraft('pool-draft-avail', {
      status: 'finalized',
      picks: [{ memberId: 'm1', teamCode: 'ENG', pickNum: 0 }],
    });
    await assertFails(
      updateDoc(doc(clientDb(), 'pools', 'pool-draft-avail', 'drafts', 'current'), {
        availableTeams: ['ENG', 'ARG', 'BRA'], // restoring a team
      })
    );
  });

  it('client CAN send a presence heartbeat on a finalized draft', async () => {
    await seedPool('pool-draft-presence');
    await seedDraft('pool-draft-presence', { status: 'finalized' });
    await assertSucceeds(
      updateDoc(doc(clientDb(), 'pools', 'pool-draft-presence', 'drafts', 'current'), {
        // presence is the ONLY allowed mutation on a finalized draft
        'presence.member1': Date.now(),
      })
    );
  });

  it('client CAN delete (reset) any draft', async () => {
    await seedPool('pool-draft-delete');
    await seedDraft('pool-draft-delete');
    await assertSucceeds(
      deleteDoc(doc(clientDb(), 'pools', 'pool-draft-delete', 'drafts', 'current'))
    );
  });
});
