/**
 * Live score sync daemon — keeps Firestore match data current.
 *
 * Run once, leave it running in a terminal during the tournament:
 *   node scripts/liveSyncDaemon.mjs
 *
 * Behaviour:
 *  - Every 5 minutes: full sync of all match statuses + scores
 *  - When live matches detected: syncs every 60 seconds until no more live matches
 *  - Writes only changed fields to Firestore (no unnecessary writes)
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = resolve(__dirname, '..');
const SA_PATH   = resolve(ROOT, 'serviceAccount.json');

const FD_KEY    = '525a3ae3c6894aa989ac691b55d4a28b';
const BASE      = 'https://api.football-data.org/v4';

const POLL_IDLE    = 5 * 60 * 1000;  // 5 min when no live games
const POLL_LIVE    = 60 * 1000;      // 60s when games are live

const STATUS_MAP = {
  SCHEDULED: 'scheduled', TIMED: 'scheduled',
  IN_PLAY: 'live', PAUSED: 'live', SUSPENDED: 'live',
  FINISHED: 'completed', AWARDED: 'completed',
  POSTPONED: 'scheduled', CANCELLED: 'scheduled',
};

const ROUND_MAP = {
  GROUP_STAGE: 'group', ROUND_OF_32: 'r32', ROUND_OF_16: 'r16',
  QUARTER_FINALS: 'qf', SEMI_FINALS: 'sf', THIRD_PLACE: 'third', FINAL: 'final',
};

// ── Firebase init ─────────────────────────────────────────────────────────────
if (!getApps().length) {
  if (existsSync(SA_PATH)) {
    initializeApp({ credential: cert(JSON.parse(readFileSync(SA_PATH, 'utf8'))) });
  } else {
    console.error('❌  serviceAccount.json not found. See syncMatches.mjs for instructions.');
    process.exit(1);
  }
}
const db = getFirestore();

// ── football-data.org fetch ───────────────────────────────────────────────────
async function fdFetch(path) {
  const res = await fetch(`${BASE}${path}`, { headers: { 'X-Auth-Token': FD_KEY } });
  if (!res.ok) throw new Error(`football-data ${res.status}: ${path}`);
  return res.json();
}

/**
 * Comprehensive TLA map — must mirror scripts/syncMatches.mjs.
 * Maps football-data.org TLA codes → our canonical app codes (src/lib/teams.js).
 */
const TLA_MAP = {
  FRA:'FRA', ESP:'ESP', ENG:'ENG', POR:'POR', NED:'NED', BEL:'BEL',
  GER:'GER', CRO:'CRO', SUI:'SUI', AUT:'AUT', TUR:'TUR', NOR:'NOR',
  CZE:'CZE', SWE:'SWE', SCO:'SCO', BIH:'BIH',
  ARG:'ARG', BRA:'BRA', COL:'COL', ECU:'ECU', PAR:'PAR',
  USA:'USA', MEX:'MEX', CAN:'CAN', PAN:'PAN', HAI:'HAI',
  JPN:'JPN', KOR:'KOR', AUS:'AUS', QAT:'QAT', IRQ:'IRQ', UZB:'UZB', JOR:'JOR',
  MAR:'MAR', SEN:'SEN', EGY:'EGY', ALG:'ALG', TUN:'TUN',
  CIV:'CIV', COD:'COD', GHA:'GHA', NZL:'NZL',
  URY:'URU', URU:'URU',
  IRI:'IRN', IRN:'IRN',
  SAU:'KSA', KSA:'KSA',
  RSA:'RSA', CUW:'CUW', CUR:'CUW',
  CPV:'CPV', CAP:'CPV',
  CGO:'COD', BOS:'BIH',
};

function normCode(tla) {
  if (!tla) return 'UNK';
  const mapped = TLA_MAP[tla];
  if (!mapped) console.warn(`  ⚠  Unknown TLA "${tla}" — storing as-is`);
  return mapped || tla;
}

function penaltyWinner(m) {
  const winner = m.score?.winner;
  if (!winner || winner === 'DRAW') return null;
  if (winner === 'HOME_TEAM') return normCode(m.homeTeam?.tla);
  if (winner === 'AWAY_TEAM') return normCode(m.awayTeam?.tla);
  return null;
}

// ── sync all matches ──────────────────────────────────────────────────────────
async function syncAll() {
  const data    = await fdFetch('/competitions/WC/matches?season=2026');
  const matches = data.matches || [];
  if (matches.length === 0) return 0;

  let liveCount = 0;
  const BATCH_SIZE = 400;

  for (let i = 0; i < matches.length; i += BATCH_SIZE) {
    const chunk = matches.slice(i, i + BATCH_SIZE);
    const batch = db.batch();

    for (const m of chunk) {
      const status = STATUS_MAP[m.status] || 'scheduled';
      const round  = ROUND_MAP[m.stage]   || 'group';
      if (status === 'live') liveCount++;

      const ref  = db.collection('matches').doc(String(m.id));
      batch.set(ref, {
        externalId: m.id,
        homeTeam:   normCode(m.homeTeam?.tla),
        awayTeam:   normCode(m.awayTeam?.tla),
        homeName:   m.homeTeam?.name || '',
        awayName:   m.awayTeam?.name || '',
        kickoff:    m.utcDate ? Timestamp.fromDate(new Date(m.utcDate)) : null,
        status,
        round,
        group:    m.group || null,
        matchday: m.matchday || null,
        score: m.score?.fullTime ? {
          home: m.score.fullTime.home ?? null,
          away: m.score.fullTime.away ?? null,
        } : null,
        // Penalty shootout winner — canonical team code, or null if n/a
        winner: penaltyWinner(m),
        updatedAt: Timestamp.now(),
      }, { merge: true });
    }

    await batch.commit();
  }

  return liveCount;
}

// ── main loop ─────────────────────────────────────────────────────────────────
async function loop() {
  let isLive = false;

  console.log(`🟢  Live sync daemon started — ${new Date().toLocaleTimeString()}`);
  console.log(`    Idle poll: every ${POLL_IDLE / 60000} min | Live poll: every ${POLL_LIVE / 1000}s\n`);

  while (true) {
    try {
      const liveCount = await syncAll();
      const now = new Date().toLocaleTimeString();

      if (liveCount > 0) {
        if (!isLive) { console.log(`⚽  ${liveCount} live match${liveCount > 1 ? 'es' : ''} detected — switching to fast poll`); isLive = true; }
        process.stdout.write(`\r[${now}]  ${liveCount} live · syncing every 60s …`);
        await sleep(POLL_LIVE);
      } else {
        if (isLive) { console.log(`\n✅  All matches finished — returning to idle poll`); isLive = false; }
        process.stdout.write(`\r[${now}]  No live matches · next sync in 5 min …`);
        await sleep(POLL_IDLE);
      }
    } catch (err) {
      console.error(`\n❌  Sync error: ${err.message} — retrying in 2 min`);
      await sleep(2 * 60 * 1000);
    }
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

loop();
