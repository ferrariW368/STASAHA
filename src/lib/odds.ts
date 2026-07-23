export type OddsRow = {
  market: '1X2' | 'SCORE' | 'OU_GOALS' | 'PLAYER_GOALS' | 'BTS' | 'NOVELTY' | 'FIGHT' | 'LATE';
  selectionKey: string;
  oddsValue: number;
};

const HOUSE_MARGIN = 1.07; // ~7% overround
const MAX_GOALS_PER_SIDE = 5; // scores computed for 0..5 goals per side
const OU_LINE = 9.5; // hali saha matches run high-scoring, so a 4.5 line was nearly always "over"

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

// Two lambda pairs model different things, deliberately decoupled:
//
// RESULT_* is calibrated to feel like a close World Cup final (~2.9 home,
// ~3.4 draw, ~3.4 away) — used for the match-winner and both-teams-to-score
// markets, where a realistic draw chance matters.
//
// SCORE_* is calibrated for the visible 0-5 score grid and per-player goal
// bands, where the individual cells need to land on sane, non-extreme odds.
//
// GOALS_* is calibrated so the over/under 9.5 line sits near a 50/50 split,
// reflecting that hali saha (5/7-a-side) matches run much higher-scoring
// than a full-size match.
const RESULT_HOME_LAMBDA = 1.0;
const RESULT_AWAY_LAMBDA = 0.9;
const SCORE_HOME_LAMBDA = 2.9;
const SCORE_AWAY_LAMBDA = 2.6;
const GOALS_HOME_LAMBDA = 5.0;
const GOALS_AWAY_LAMBDA = 4.6;

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

function computeScores(): OddsRow[] {
  const rows: OddsRow[] = [];
  for (let h = 0; h <= MAX_GOALS_PER_SIDE; h++) {
    for (let a = 0; a <= MAX_GOALS_PER_SIDE; a++) {
      const p = poissonPmf(SCORE_HOME_LAMBDA, h) * poissonPmf(SCORE_AWAY_LAMBDA, a);
      rows.push({ market: 'SCORE', selectionKey: `${h}-${a}`, oddsValue: oddsFromProbability(p) });
    }
  }
  return rows;
}

function computeOverUnder(): OddsRow[] {
  let pUnder = 0;
  for (let h = 0; h <= MAX_GOALS_PER_SIDE; h++) {
    for (let a = 0; a <= MAX_GOALS_PER_SIDE; a++) {
      if (h + a < OU_LINE) pUnder += poissonPmf(GOALS_HOME_LAMBDA, h) * poissonPmf(GOALS_AWAY_LAMBDA, a);
    }
  }
  const pOver = 1 - pUnder;
  return [
    { market: 'OU_GOALS', selectionKey: `OVER_${OU_LINE}`, oddsValue: oddsFromProbability(pOver) },
    { market: 'OU_GOALS', selectionKey: `UNDER_${OU_LINE}`, oddsValue: oddsFromProbability(pUnder) },
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
    [homePlayerIds, SCORE_HOME_LAMBDA],
    [awayPlayerIds, SCORE_AWAY_LAMBDA],
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

export function computeMatchOdds(homePlayerIds: string[], awayPlayerIds: string[]): OddsRow[] {
  return [
    ...compute1X2(),
    ...computeScores(),
    ...computeOverUnder(),
    ...computeBothTeamsScore(),
    ...computeNoveltyMarkets(),
    ...computePlayerNoveltyMarkets(homePlayerIds, awayPlayerIds),
    ...computePlayerGoals(homePlayerIds, awayPlayerIds),
  ];
}
