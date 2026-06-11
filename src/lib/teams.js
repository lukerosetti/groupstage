export const TEAMS = [
  // UEFA (16)
  { code: 'FRA', name: 'France', flag: '🇫🇷', conf: 'UEFA', rank: 1 },
  { code: 'ESP', name: 'Spain', flag: '🇪🇸', conf: 'UEFA', rank: 2 },
  { code: 'ENG', name: 'England', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', conf: 'UEFA', rank: 4 },
  { code: 'POR', name: 'Portugal', flag: '🇵🇹', conf: 'UEFA', rank: 5 },
  { code: 'NED', name: 'Netherlands', flag: '🇳🇱', conf: 'UEFA', rank: 7 },
  { code: 'BEL', name: 'Belgium', flag: '🇧🇪', conf: 'UEFA', rank: 8 },
  { code: 'GER', name: 'Germany', flag: '🇩🇪', conf: 'UEFA', rank: 10 },
  { code: 'CRO', name: 'Croatia', flag: '🇭🇷', conf: 'UEFA', rank: 11 },
  { code: 'SUI', name: 'Switzerland', flag: '🇨🇭', conf: 'UEFA', rank: 13 },
  { code: 'AUT', name: 'Austria', flag: '🇦🇹', conf: 'UEFA', rank: 25 },
  { code: 'TUR', name: 'Türkiye', flag: '🇹🇷', conf: 'UEFA', rank: 27 },
  { code: 'NOR', name: 'Norway', flag: '🇳🇴', conf: 'UEFA', rank: 28 },
  { code: 'CZE', name: 'Czechia', flag: '🇨🇿', conf: 'UEFA', rank: 33 },
  { code: 'SWE', name: 'Sweden', flag: '🇸🇪', conf: 'UEFA', rank: 36 },
  { code: 'SCO', name: 'Scotland', flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', conf: 'UEFA', rank: 38 },
  { code: 'BIH', name: 'Bosnia & Herz.', flag: '🇧🇦', conf: 'UEFA', rank: 65 },
  // CONMEBOL (6)
  { code: 'ARG', name: 'Argentina', flag: '🇦🇷', conf: 'CONMEBOL', rank: 3 },
  { code: 'BRA', name: 'Brazil', flag: '🇧🇷', conf: 'CONMEBOL', rank: 6 },
  { code: 'COL', name: 'Colombia', flag: '🇨🇴', conf: 'CONMEBOL', rank: 14 },
  { code: 'URU', name: 'Uruguay', flag: '🇺🇾', conf: 'CONMEBOL', rank: 17 },
  { code: 'ECU', name: 'Ecuador', flag: '🇪🇨', conf: 'CONMEBOL', rank: 35 },
  { code: 'PAR', name: 'Paraguay', flag: '🇵🇾', conf: 'CONMEBOL', rank: 45 },
  // CONCACAF (6)
  { code: 'USA', name: 'United States', flag: '🇺🇸', conf: 'CONCACAF', rank: 16 },
  { code: 'MEX', name: 'Mexico', flag: '🇲🇽', conf: 'CONCACAF', rank: 18 },
  { code: 'CAN', name: 'Canada', flag: '🇨🇦', conf: 'CONCACAF', rank: 31 },
  { code: 'PAN', name: 'Panama', flag: '🇵🇦', conf: 'CONCACAF', rank: 39 },
  { code: 'HAI', name: 'Haiti', flag: '🇭🇹', conf: 'CONCACAF', rank: 85 },
  { code: 'CUW', name: 'Curaçao', flag: '🇨🇼', conf: 'CONCACAF', rank: 90 },
  // AFC
  { code: 'JPN', name: 'Japan', flag: '🇯🇵', conf: 'AFC', rank: 19 },
  { code: 'IRN', name: 'Iran', flag: '🇮🇷', conf: 'AFC', rank: 22 },
  { code: 'KOR', name: 'South Korea', flag: '🇰🇷', conf: 'AFC', rank: 23 },
  { code: 'AUS', name: 'Australia', flag: '🇦🇺', conf: 'AFC', rank: 24 },
  { code: 'KSA', name: 'Saudi Arabia', flag: '🇸🇦', conf: 'AFC', rank: 56 },
  { code: 'QAT', name: 'Qatar', flag: '🇶🇦', conf: 'AFC', rank: 58 },
  { code: 'IRQ', name: 'Iraq', flag: '🇮🇶', conf: 'AFC', rank: 62 },
  { code: 'UZB', name: 'Uzbekistan', flag: '🇺🇿', conf: 'AFC', rank: 65 },
  { code: 'JOR', name: 'Jordan', flag: '🇯🇴', conf: 'AFC', rank: 70 },
  // CAF
  { code: 'MAR', name: 'Morocco', flag: '🇲🇦', conf: 'CAF', rank: 12 },
  { code: 'SEN', name: 'Senegal', flag: '🇸🇳', conf: 'CAF', rank: 20 },
  { code: 'EGY', name: 'Egypt', flag: '🇪🇬', conf: 'CAF', rank: 32 },
  { code: 'ALG', name: 'Algeria', flag: '🇩🇿', conf: 'CAF', rank: 38 },
  { code: 'TUN', name: 'Tunisia', flag: '🇹🇳', conf: 'CAF', rank: 41 },
  { code: 'CIV', name: "Côte d'Ivoire", flag: '🇨🇮', conf: 'CAF', rank: 44 },
  { code: 'RSA', name: 'South Africa', flag: '🇿🇦', conf: 'CAF', rank: 50 },
  { code: 'COD', name: 'DR Congo', flag: '🇨🇩', conf: 'CAF', rank: 60 },
  { code: 'GHA', name: 'Ghana', flag: '🇬🇭', conf: 'CAF', rank: 70 },
  { code: 'CPV', name: 'Cape Verde', flag: '🇨🇻', conf: 'CAF', rank: 80 },
  // OFC
  { code: 'NZL', name: 'New Zealand', flag: '🇳🇿', conf: 'OFC', rank: 95 },
];

export const teamByCode = Object.fromEntries(TEAMS.map(t => [t.code, t]));

/**
 * Aliases: maps every known football-data.org TLA variant → our canonical code.
 * Add entries here whenever a new mismatch surfaces; never change the canonical
 * codes in TEAMS (those are the source of truth for the app).
 */
export const TLA_ALIASES = {
  // URY is what football-data.org sends; URU is our canonical
  URY: 'URU',
  // Iran variants
  IRI: 'IRN',
  // Saudi Arabia variants
  SAU: 'KSA',
  // South Korea variants
  PRK: 'KOR',  // just in case
  // Cape Verde variants
  CAP: 'CPV',
  // Côte d'Ivoire variants
  CIV: 'CIV',
  // DR Congo variants
  CGO: 'COD',
  // Bosnia variants
  BOS: 'BIH',
  // Curaçao variants
  CUR: 'CUW',
  // United States variants
  US:  'USA',
  // New Zealand variants
  NZE: 'NZL',
};

/**
 * Resolve any TLA (including football-data.org variants) to our canonical
 * team object.  Returns undefined if truly unknown.
 */
export function resolveTeam(tla) {
  if (!tla) return undefined;
  return teamByCode[tla] || teamByCode[TLA_ALIASES[tla]];
}

/** Resolve TLA → canonical code string (or the original if unknown). */
export function resolveCode(tla) {
  if (!tla) return 'UNK';
  return TLA_ALIASES[tla] || tla;
}

// ── Dev assertion: all 48 teams must resolve to a flag ────────────────────────
if (import.meta.env?.DEV) {
  const missing = TEAMS.filter(t => !t.flag || !t.code);
  if (missing.length) {
    console.error('🚨 teams.js: entries missing code or flag:', missing.map(t => t.name));
  }
}
