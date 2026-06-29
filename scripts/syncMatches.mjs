/**
 * Syncs all 2026 World Cup matches from football-data.org into Firestore.
 * Run:  node scripts/syncMatches.mjs
 *
 * Needs GOOGLE_APPLICATION_CREDENTIALS env var pointing to your Firebase
 * service account JSON, OR set FIREBASE_PROJECT_ID + use Application Default Credentials.
 *
 * Quickest path: download a service account key from Firebase console →
 * Project Settings → Service Accounts → Generate new private key
 * then:  GOOGLE_APPLICATION_CREDENTIALS=./serviceAccount.json node scripts/syncMatches.mjs
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// ── Firebase init ────────────────────────────────────────────────────────────
const SA_PATH = resolve(ROOT, 'serviceAccount.json');
if (!getApps().length) {
  if (existsSync(SA_PATH)) {
    initializeApp({ credential: cert(JSON.parse(readFileSync(SA_PATH, 'utf8'))) });
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    initializeApp({ credential: cert(JSON.parse(readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8'))) });
  } else {
    console.error('❌  No service account found. See instructions at top of this file.');
    process.exit(1);
  }
}
const db = getFirestore();

// ── football-data.org ────────────────────────────────────────────────────────
const FD_KEY = '525a3ae3c6894aa989ac691b55d4a28b';
const BASE   = 'https://api.football-data.org/v4';

async function fdFetch(path) {
  const res = await fetch(`${BASE}${path}`, { headers: { 'X-Auth-Token': FD_KEY } });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`football-data.org ${res.status} ${path}: ${txt}`);
  }
  return res.json();
}

// ── normalisers ──────────────────────────────────────────────────────────────
const STATUS_MAP = {
  SCHEDULED: 'scheduled', TIMED: 'scheduled',
  IN_PLAY: 'live', PAUSED: 'live', SUSPENDED: 'live',
  FINISHED: 'completed', AWARDED: 'completed',
  POSTPONED: 'scheduled', CANCELLED: 'scheduled',
};

const ROUND_MAP = {
  GROUP_STAGE:    'group',
  LAST_32:        'r32',   // football-data.org 2026 WC stage name
  LAST_16:        'r16',
  QUARTER_FINALS: 'qf',
  SEMI_FINALS:    'sf',
  THIRD_PLACE:    'third',
  FINAL:          'final',
  // Legacy aliases
  ROUND_OF_32:    'r32',
  ROUND_OF_16:    'r16',
};

/**
 * Comprehensive TLA map: football-data.org code → our canonical app code.
 * The right-hand side must always match a `code` in src/lib/teams.js.
 * Add entries here (never change canonical codes) when a new mismatch surfaces.
 */
const TLA_MAP = {
  // Pass-throughs (explicit to catch future renames)
  FRA:'FRA', ESP:'ESP', ENG:'ENG', POR:'POR', NED:'NED', BEL:'BEL',
  GER:'GER', CRO:'CRO', SUI:'SUI', AUT:'AUT', TUR:'TUR', NOR:'NOR',
  CZE:'CZE', SWE:'SWE', SCO:'SCO', BIH:'BIH',
  ARG:'ARG', BRA:'BRA', COL:'COL', ECU:'ECU', PAR:'PAR',
  USA:'USA', MEX:'MEX', CAN:'CAN', PAN:'PAN', HAI:'HAI',
  JPN:'JPN', KOR:'KOR', AUS:'AUS', QAT:'QAT', IRQ:'IRQ', UZB:'UZB', JOR:'JOR',
  MAR:'MAR', SEN:'SEN', EGY:'EGY', ALG:'ALG', TUN:'TUN',
  CIV:'CIV', COD:'COD', GHA:'GHA', NZL:'NZL',
  // Known football-data.org variants → our canonical codes
  URY: 'URU',   // Uruguay
  URU: 'URU',
  IRI: 'IRN',   // Iran
  IRN: 'IRN',
  SAU: 'KSA',   // Saudi Arabia
  KSA: 'KSA',
  RSA: 'RSA',   // South Africa
  CUW: 'CUW',   // Curaçao
  CUR: 'CUW',
  CPV: 'CPV',   // Cape Verde
  CAP: 'CPV',
  CGO: 'COD',   // DR Congo alt
  BOS: 'BIH',   // Bosnia alt
};

function normCode(tla) {
  if (!tla) return 'UNK';
  const mapped = TLA_MAP[tla];
  if (!mapped) console.warn(`  ⚠  Unknown TLA "${tla}" — storing as-is. Add to TLA_MAP if needed.`);
  return mapped || tla;
}

/** Extract the penalty shootout winner code from a football-data match object. */
function penaltyWinner(m) {
  // football-data.org sets score.winner to "HOME_TEAM" | "AWAY_TEAM" | "DRAW"
  // and score.penalties with home/away counts when the match went to penalties.
  const pen = m.score?.penalties;
  const winner = m.score?.winner;
  if (!pen && !winner) return null;
  if (winner === 'HOME_TEAM') return normCode(m.homeTeam?.tla);
  if (winner === 'AWAY_TEAM') return normCode(m.awayTeam?.tla);
  return null;
}

function toTimestamp(dateStr) {
  if (!dateStr) return null;
  return Timestamp.fromDate(new Date(dateStr));
}

// ── main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('Fetching matches from football-data.org…');
  const data = await fdFetch('/competitions/WC/matches?season=2026');
  const matches = data.matches || [];
  console.log(`  Got ${matches.length} matches`);

  if (matches.length === 0) {
    // If the 2026 competition isn't available yet on the free tier,
    // try the current season / check what's available
    console.log('\nNote: If 0 matches returned, the 2026 WC may not be loaded yet.');
    console.log('Checking available competitions…');
    const comps = await fdFetch('/competitions');
    const wc = comps.competitions?.find(c => c.code === 'WC');
    if (wc) {
      console.log('WC competition found:', JSON.stringify(wc, null, 2));
    } else {
      console.log('Available competitions:', comps.competitions?.map(c => `${c.code} (${c.name})`).join(', '));
    }
    return;
  }

  // Write in batches of 500 (Firestore limit)
  let written = 0;
  const BATCH_SIZE = 400;

  for (let i = 0; i < matches.length; i += BATCH_SIZE) {
    const chunk = matches.slice(i, i + BATCH_SIZE);
    const batch = db.batch();

    for (const m of chunk) {
      const ref = db.collection('matches').doc(String(m.id));
      const homeCode = normCode(m.homeTeam?.tla);
      const awayCode = normCode(m.awayTeam?.tla);
      const status   = STATUS_MAP[m.status] || 'scheduled';
      const round    = ROUND_MAP[m.stage]   || 'group';

      const doc = {
        externalId:  m.id,
        homeTeam:    homeCode,
        awayTeam:    awayCode,
        homeName:    m.homeTeam?.name || '',
        awayName:    m.awayTeam?.name || '',
        kickoff:     toTimestamp(m.utcDate),
        status,
        round,
        group:       m.group || null,
        matchday:    m.matchday || null,
        score: m.score?.fullTime ? {
          home: m.score.fullTime.home ?? null,
          away: m.score.fullTime.away ?? null,
        } : null,
        // winner: canonical team code of match winner (set for penalty shootout deciders
        // where fullTime score is level — HOME_TEAM / AWAY_TEAM from football-data).
        winner: penaltyWinner(m),
        updatedAt: Timestamp.now(),
      };

      batch.set(ref, doc, { merge: true });
    }

    await batch.commit();
    written += chunk.length;
    console.log(`  Wrote ${written}/${matches.length} matches`);
  }

  console.log(`\n✅  Synced ${written} matches to Firestore.`);
}

main().catch(err => { console.error('❌', err.message); process.exit(1); });
