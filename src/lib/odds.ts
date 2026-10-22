export type OddsRow = {
  market: '1X2' | 'SCORE' | 'OU_GOALS' | 'HT_OU_GOALS' | 'PLAYER_GOALS' | 'BTS' | 'NOVELTY' | 'FIGHT' | 'LATE';
  selectionKey: string;
  oddsValue: number;
};

const HOUSE_MARGIN = 1.07; // ~7% overround
export const MAX_GOALS_PER_SIDE = 10; // SCORE grid computed for 0..10 goals per side - hali saha blowouts (12-0, 14-2) easily hit double digits on one side
const OU_MAX_GOALS_PER_SIDE = 20; // wider bound so the OU sum stays accurate at any admin-chosen line
const DEFAULT_OU_LINE = 9.5; // hali saha matches run high-scoring, so a 4.5 line was nearly always "over"
const DEFAULT_HT_OU_LINE = 4.5; // first-half line, roughly half the full-match line
const MAX_SCORE_ODDS = 40; // correct-score grid odds are capped here - an uncapped 0-0 on this high-scoring lambda would show 5-digit "odds" that just look broken, not long-shot

function factorial(n: number): number {
  let result = 1;
  for (let i = 2; i <= n; i++) result *= i;
  return result;
}

function poissonPmf(lambda: number, k: number): number {
  return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k);
}

function oddsFromProbability(p: number): number {
  const raw = 1 / p;
  return Math.round(raw * HOUSE_MARGIN * 100) / 100;
}

// RESULT_* is calibrated to feel like a close World Cup final (~2.9 home,
// ~3.4 draw, ~3.4 away) — used for the match-winner and both-teams-to-score
// markets, where a realistic draw/no-show chance matters more than raw goal
// count.
//
// GOALS_* drives every other goal-count-based market (score grid, over/under,
// both-teams-to-score, per-player goal bands) from one shared lambda pair, so
// they stay statistically consistent with each other — hali saha (5/7-a-side)
// matches run much higher-scoring than a full-size match, with blowouts
// (12-0, 14-2) common, so a 0-0 or 1-1 correctly gets very long odds here.
const RESULT_HOME_LAMBDA = 1.0;
const RESULT_AWAY_LAMBDA = 0.9;
const GOALS_HOME_LAMBDA = 5.5;
const GOALS_AWAY_LAMBDA = 5.0;

function compute1X2(): OddsRow[] {
  let pHome = 0;
  let pDraw = 0;
  let pAway = 0;
  for (let h = 0; h <= MAX_GOALS_PER_SIDE; h++) {
    for (let a = 0; a <= MAX_GOALS_PER_SIDE; a++) {
      const p = poissonPmf(RESULT_HOME_LAMBDA, h) * poissonPmf(RESULT_AWAY_LAMBDA, a);
      if (h > a) pHome += p;
      else if (h === a) pDraw += p;
      else pAway += p;
    }
  }
  return [
    { market: '1X2', selectionKey: '1', oddsValue: oddsFromProbability(pHome) },
    { market: '1X2', selectionKey: 'X', oddsValue: oddsFromProbability(pDraw) },
    { market: '1X2', selectionKey: '2', oddsValue: oddsFromProbability(pAway) },
  ];
}

// The raw Poisson probabilities for an 11x11 grid span several orders of
// magnitude (the single most-likely cell is already only ~3% likely), so a
// flat odds cap left almost every cell pinned at MAX_SCORE_ODDS. Instead,
// rank every cell by probability and spread the ranks smoothly across
// [MIN_SCORE_ODDS, MAX_SCORE_ODDS] - the ordering still comes straight from
// the Poisson model (more likely score = lower odds), it just no longer
// relies on the raw probability's magnitude, which is what let a handful of
// cells crowd out the rest of the range.
const MIN_SCORE_ODDS = 2.5;

function computeScores(): OddsRow[] {
  const cells: { h: number; a: number; p: number }[] = [];
  for (let h = 0; h <= MAX_GOALS_PER_SIDE; h++) {
    for (let a = 0; a <= MAX_GOALS_PER_SIDE; a++) {
      cells.push({ h, a, p: poissonPmf(GOALS_HOME_LAMBDA, h) * poissonPmf(GOALS_AWAY_LAMBDA, a) });
    }
  }
  cells.sort((x, y) => y.p - x.p); // most likely first

  const n = cells.length;
  return cells.map((c, rank) => {
    const t = n > 1 ? rank / (n - 1) : 0; // 0 = most likely, 1 = least likely
    const curved = Math.pow(t, 0.7); // keeps the likely cluster tighter near the low end
    const oddsValue = Math.round((MIN_SCORE_ODDS + curved * (MAX_SCORE_ODDS - MIN_SCORE_ODDS)) * 100) / 100;
    return { market: 'SCORE' as const, selectionKey: `${c.h}-${c.a}`, oddsValue };
  });
}

function computeOverUnder(ouLine: number): OddsRow[] {
  let pUnder = 0;
  for (let h = 0; h <= OU_MAX_GOALS_PER_SIDE; h++) {
    for (let a = 0; a <= OU_MAX_GOALS_PER_SIDE; a++) {
      if (h + a < ouLine) pUnder += poissonPmf(GOALS_HOME_LAMBDA, h) * poissonPmf(GOALS_AWAY_LAMBDA, a);
    }
  }
  const pOver = 1 - pUnder;
  return [
    { market: 'OU_GOALS', selectionKey: `OVER_${ouLine}`, oddsValue: oddsFromProbability(pOver) },
    { market: 'OU_GOALS', selectionKey: `UNDER_${ouLine}`, oddsValue: oddsFromProbability(pUnder) },
  ];
}

// First-half total goals - modeled as half the full-match lambda, on the
// simplifying assumption that goals split roughly evenly across the two
// halves.
function computeHalfTimeOverUnder(htOuLine: number): OddsRow[] {
  const htHomeLambda = GOALS_HOME_LAMBDA / 2;
  const htAwayLambda = GOALS_AWAY_LAMBDA / 2;
  let pUnder = 0;
  for (let h = 0; h <= OU_MAX_GOALS_PER_SIDE; h++) {
    for (let a = 0; a <= OU_MAX_GOALS_PER_SIDE; a++) {
      if (h + a < htOuLine) pUnder += poissonPmf(htHomeLambda, h) * poissonPmf(htAwayLambda, a);
    }
  }
  const pOver = 1 - pUnder;
  return [
    { market: 'HT_OU_GOALS', selectionKey: `OVER_${htOuLine}`, oddsValue: oddsFromProbability(pOver) },
    { market: 'HT_OU_GOALS', selectionKey: `UNDER_${htOuLine}`, oddsValue: oddsFromProbability(pUnder) },
  ];
}

function computeBothTeamsScore(): OddsRow[] {
  let pBothScore = 0;
  for (let h = 1; h <= MAX_GOALS_PER_SIDE; h++) {
    for (let a = 1; a <= MAX_GOALS_PER_SIDE; a++) {
      pBothScore += poissonPmf(RESULT_HOME_LAMBDA, h) * poissonPmf(RESULT_AWAY_LAMBDA, a);
    }
  }
  const pNoBothScore = 1 - pBothScore;
  return [
    { market: 'BTS', selectionKey: 'YES', oddsValue: oddsFromProbability(pBothScore) },
    { market: 'BTS', selectionKey: 'NO', oddsValue: oddsFromProbability(pNoBothScore) },
  ];
}

// Novelty/joke markets common on informal hali saha betting pools. These
// aren't derivable from the final score, so fixed, hand-picked odds are used
// instead of Poisson math — admin reports the outcome manually at settlement.
function computeNoveltyMarkets(): OddsRow[] {
  return [
    { market: 'NOVELTY', selectionKey: 'RED_CARD_YES', oddsValue: 3.5 },
    { market: 'NOVELTY', selectionKey: 'RED_CARD_NO', oddsValue: 1.3 },
    { market: 'NOVELTY', selectionKey: 'PITCH_INVASION_YES', oddsValue: 15.0 },
    { market: 'NOVELTY', selectionKey: 'PITCH_INVASION_NO', oddsValue: 1.05 },
    { market: 'NOVELTY', selectionKey: 'REFEREE_ARGUMENT_YES', oddsValue: 2.5 },
    { market: 'NOVELTY', selectionKey: 'REFEREE_ARGUMENT_NO', oddsValue: 1.45 },
    { market: 'NOVELTY', selectionKey: 'MATCH_ABANDONED_YES', oddsValue: 20.0 },
    { market: 'NOVELTY', selectionKey: 'MATCH_ABANDONED_NO', oddsValue: 1.03 },
  ];
}

// Per-player novelty markets — just like the match-level ones above, these
// are jokes for the friend group rather than statistically modeled, so they
// use fixed odds identical for every player, reported manually at settlement.
function computePlayerNoveltyMarkets(homePlayerIds: string[], awayPlayerIds: string[]): OddsRow[] {
  const rows: OddsRow[] = [];
  for (const pid of [...homePlayerIds, ...awayPlayerIds]) {
    rows.push({ market: 'FIGHT', selectionKey: `${pid}:YES`, oddsValue: 6.0 });
    rows.push({ market: 'FIGHT', selectionKey: `${pid}:NO`, oddsValue: 1.15 });
    rows.push({ market: 'LATE', selectionKey: `${pid}:YES`, oddsValue: 4.0 });
    rows.push({ market: 'LATE', selectionKey: `${pid}:NO`, oddsValue: 1.2 });
  }
  return rows;
}

// Bands are "scores at least 1" and "scores 2+" only — a "scores exactly 0"
// band was dropped because it's the near-certain outcome for any one player
// on a multi-player team, making its odds comically close to 1.0.
function computePlayerGoals(homePlayerIds: string[], awayPlayerIds: string[]): OddsRow[] {
  const rows: OddsRow[] = [];
  const sides: [string[], number][] = [
    [homePlayerIds, GOALS_HOME_LAMBDA],
    [awayPlayerIds, GOALS_AWAY_LAMBDA],
  ];
  for (const [playerIds, teamLambda] of sides) {
    if (playerIds.length === 0) continue;
    const playerLambda = teamLambda / playerIds.length;
    for (const pid of playerIds) {
      const p0 = poissonPmf(playerLambda, 0);
      const p1 = poissonPmf(playerLambda, 1);
      const p1plus = 1 - p0;
      const p2plus = 1 - p0 - p1;
      rows.push({ market: 'PLAYER_GOALS', selectionKey: `${pid}:1+`, oddsValue: oddsFromProbability(p1plus) });
      rows.push({ market: 'PLAYER_GOALS', selectionKey: `${pid}:2+`, oddsValue: oddsFromProbability(p2plus) });
    }
  }
  return rows;
}

export function computeMatchOdds(
  homePlayerIds: string[],
  awayPlayerIds: string[],
  ouLine: number = DEFAULT_OU_LINE,
  htOuLine: number = DEFAULT_HT_OU_LINE
): OddsRow[] {
  return [
    ...compute1X2(),
    ...computeScores(),
    ...computeOverUnder(ouLine),
    ...computeHalfTimeOverUnder(htOuLine),
    ...computeBothTeamsScore(),
    ...computeNoveltyMarkets(),
    ...computePlayerNoveltyMarkets(homePlayerIds, awayPlayerIds),
    ...computePlayerGoals(homePlayerIds, awayPlayerIds),
  ];
}
