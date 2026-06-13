/**
 * One-shot score sync — designed to be called by GitHub Actions every 5 minutes.
 *
 * Firestore Spark free tier = 20,000 writes/day.
 * This script avoids blowing that limit by:
 *   1. Skipping matches that are already completed WITH a score (they never change).
 *   2. Only writing documents where something actually changed.
 *   3. Exiting early if no matches are live or scheduled today.
 *
 * Run manually:  node scripts/syncScores.mjs
 * GitHub Actions: triggered by .github/workflows/sync-scores.yml every 5 minutes.
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = resolve(__dirname, '..');
const SA_PATH   = resolve(ROOT, 'serviceAccount.json');

// ── Firebase init ─────────────────────────────────────────────────────────────
if (!getApps().length) {
  // Local: use serviceAccount.json
  if (existsSync(SA_PATH)) {
    initializeApp({ credential: cert(JSON.parse(readFileSync(SA_PATH, 'utf8'))) });
  // GitHub Actions: service account JSON stored as a secret env var
  } else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
  } else {
    console.error('❌  No Firebase credentials found.');
    console.error('    Local: add serviceAccount.json to project root.');
    console.error('    GitHub Actions: set FIREBASE_SERVICE_ACCOUNT secret.');
    process.exit(1);
  }
}
const db = getFirestore();

// ── football-data.org ─────────────────────────────────────────────────────────
const FD_KEY = process.env.FOOTBALL_DATA_KEY || '525a3ae3c6894aa989ac691b55d4a28b';
const BASE   = 'https://api.football-data.org/v4';

async function fdFetch(path) {
  const res = await fetch(`${BASE}${path}`, { headers: { 'X-Auth-Token': FD_KEY } });
  if (!res.ok) throw new Error(`football-data ${res.status}: ${path}`);
  return res.json();
}

// ── Normalisers (keep in sync with liveSyncDaemon.mjs) ───────────────────────
const STATUS_MAP = {
  SCHEDULED: 'scheduled', TIMED: 'scheduled',
  IN_PLAY: 'live', PAUSED: 'live', SUSPENDED: 'live',
  FINISHED: 'completed', AWARDED: 'completed',
  POSTPONED: 'scheduled', CANCELLED: 'scheduled',
};

const ROUND_MAP = {
  GROUP_STAGE:    'group',
  ROUND_OF_32:    'r32',
  ROUND_OF_16:    'r16',
  QUARTER_FINALS: 'qf',
  SEMI_FINALS:    'sf',
  THIRD_PLACE:    'third',
  FINAL:          'final',
};

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
  if (!mapped) console.warn(`  ⚠  Unknown TLA "${tla}"`);
  return mapped || tla;
}

function penaltyWinner(m) {
  const winner = m.score?.winner;
  if (!winner || winner === 'DRAW') return null;
  if (winner === 'HOME_TEAM') return normCode(m.homeTeam?.tla);
  if (winner === 'AWAY_TEAM') return normCode(m.awayTeam?.tla);
  return null;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`[${new Date().toISOString()}] Starting score sync…`);

  const data    = await fdFetch('/competitions/WC/matches?season=2026');
  const matches = data.matches || [];
  console.log(`  Fetched ${matches.length} matches from football-data.org`);

  if (matches.length === 0) {
    console.log('  No matches returned — competition may not be seeded yet.');
    return;
  }

  // Load existing Firestore docs so we can skip unchanged ones
  const existingSnap = await db.collection('matches').get();
  const existing = {};
  for (const d of existingSnap.docs) existing[d.id] = d.data();

  let writes = 0;
  let skipped = 0;
  const BATCH_SIZE = 400;

  for (let i = 0; i < matches.length; i += BATCH_SIZE) {
    const chunk = matches.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    let batchWrites = 0;

    for (const m of chunk) {
      const docId   = String(m.id);
      const status  = STATUS_MAP[m.status]  || 'scheduled';
      const round   = ROUND_MAP[m.stage]    || 'group';

      // ── Skip completed matches only when team codes are already correct ────
      // If homeTeam/awayTeam are still 'UNK' (seeded before API had team data),
      // we must NOT skip — we need to write the real codes even on finished games.
      const prev = existing[docId];
      const homeCode_peek = normCode(m.homeTeam?.tla);
      const awayCode_peek = normCode(m.awayTeam?.tla);
      if (
        prev &&
        prev.status === 'completed' &&
        status === 'completed' &&
        prev.score?.home != null &&
        prev.score?.away != null &&
        prev.homeTeam !== 'UNK' &&
        prev.awayTeam !== 'UNK' &&
        prev.homeTeam === homeCode_peek &&
        prev.awayTeam === awayCode_peek
      ) {
        skipped++;
        continue;
      }

      const homeCode  = normCode(m.homeTeam?.tla);
      const awayCode  = normCode(m.awayTeam?.tla);
      const scoreHome = m.score?.fullTime?.home ?? null;
      const scoreAway = m.score?.fullTime?.away ?? null;
      const winner    = penaltyWinner(m);

      // ── Skip if nothing has changed ──────────────────────────────────────
      if (
        prev &&
        prev.status    === status &&
        prev.score?.home === scoreHome &&
        prev.score?.away === scoreAway &&
        (prev.winner ?? null) === winner &&
        prev.homeTeam  === homeCode &&
        prev.awayTeam  === awayCode
      ) {
        skipped++;
        continue;
      }

      const ref = db.collection('matches').doc(docId);
      batch.set(ref, {
        externalId: m.id,
        homeTeam:   homeCode,
        awayTeam:   awayCode,
        homeName:   m.homeTeam?.name || '',
        awayName:   m.awayTeam?.name || '',
        kickoff:    m.utcDate ? Timestamp.fromDate(new Date(m.utcDate)) : null,
        status,
        round,
        group:      m.group    || null,
        matchday:   m.matchday || null,
        score:      (scoreHome != null || scoreAway != null)
          ? { home: scoreHome, away: scoreAway }
          : null,
        winner,
        updatedAt: Timestamp.now(),
      }, { merge: true });

      batchWrites++;
    }

    if (batchWrites > 0) {
      await batch.commit();
      writes += batchWrites;
    }
  }

  console.log(`  ✅  Done — ${writes} written, ${skipped} unchanged (skipped)`);
}

main().catch(err => {
  console.error('❌  Sync failed:', err.message);
  process.exit(1);
});
