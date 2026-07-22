export type OddsRow = {
  market: '1X2' | 'SCORE' | 'OU_GOALS' | 'PLAYER_GOALS';
  selectionKey: string;
  oddsValue: number;
};

const HOUSE_MARGIN = 1.07; // ~7% overround
const MAX_GOALS_PER_SIDE = 5; // scores computed for 0..5 goals per side
const OU_LINE = 4.5;

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

// Two evenly-matched sides (world-cup-final-inspired: no clear favorite),
// home side gets a small home-field bump.
const HOME_LAMBDA = 2.9;
const AWAY_LAMBDA = 2.6;

function compute1X2(): OddsRow[] {
  let pHome = 0;
  let pDraw = 0;
  let pAway = 0;
  for (let h = 0; h <= MAX_GOALS_PER_SIDE; h++) {
    for (let a = 0; a <= MAX_GOALS_PER_SIDE; a++) {
      const p = poissonPmf(HOME_LAMBDA, h) * poissonPmf(AWAY_LAMBDA, a);
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
      const p = poissonPmf(HOME_LAMBDA, h) * poissonPmf(AWAY_LAMBDA, a);
      rows.push({ market: 'SCORE', selectionKey: `${h}-${a}`, oddsValue: oddsFromProbability(p) });
    }
  }
  return rows;
}

function computeOverUnder(): OddsRow[] {
  let pUnder = 0;
  for (let h = 0; h <= MAX_GOALS_PER_SIDE; h++) {
    for (let a = 0; a <= MAX_GOALS_PER_SIDE; a++) {
      if (h + a < OU_LINE) pUnder += poissonPmf(HOME_LAMBDA, h) * poissonPmf(AWAY_LAMBDA, a);
    }
  }
  const pOver = 1 - pUnder;
  return [
    { market: 'OU_GOALS', selectionKey: `OVER_${OU_LINE}`, oddsValue: oddsFromProbability(pOver) },
    { market: 'OU_GOALS', selectionKey: `UNDER_${OU_LINE}`, oddsValue: oddsFromProbability(pUnder) },
  ];
}

function computePlayerGoals(homePlayerIds: string[], awayPlayerIds: string[]): OddsRow[] {
  const rows: OddsRow[] = [];
  const sides: [string[], number][] = [
    [homePlayerIds, HOME_LAMBDA],
    [awayPlayerIds, AWAY_LAMBDA],
  ];
  for (const [playerIds, teamLambda] of sides) {
    if (playerIds.length === 0) continue;
    const playerLambda = teamLambda / playerIds.length;
    for (const pid of playerIds) {
      const p0 = poissonPmf(playerLambda, 0);
      const p1 = poissonPmf(playerLambda, 1);
      const p2plus = 1 - p0 - p1;
      rows.push({ market: 'PLAYER_GOALS', selectionKey: `${pid}:0`, oddsValue: oddsFromProbability(p0) });
      rows.push({ market: 'PLAYER_GOALS', selectionKey: `${pid}:1`, oddsValue: oddsFromProbability(p1) });
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
    ...computePlayerGoals(homePlayerIds, awayPlayerIds),
  ];
}
