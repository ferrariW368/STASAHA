# Halı Saha Oran Motoru — Maç Seed'li Kalibrasyon Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every hali saha match its own small, deterministic odds variation (favored side, KG Var/Yok, goal tempo) derived only from the match's own identity — never from team/player ratings — and fix the existing bug where KG Var/Yok reuses the wrong (low-scoring) lambda pair.

**Architecture:** `src/lib/odds.ts` stays a pure, DB-free module. It gains a required `matchSeed: string` parameter on `computeMatchOdds`, hashes it (FNV-1a) into a numeric seed, feeds that into the existing `mulberry32` PRNG (reused from `src/lib/horseRace.ts`), and draws a fixed, ordered sequence of numbers from it to compute three independent lambda pairs: RESULT (1X2), BTS (KG Var/Yok, now separated from RESULT), and GOALS (SCORE/OU_GOALS/HT_OU_GOALS/PLAYER_GOALS, unified). `src/actions/matches.ts` builds the seed string from `match.id`/team ids/kickoff time and passes it through — no schema change needed.

**Tech Stack:** TypeScript, Vitest, Prisma (unaffected — no schema change), no new dependencies.

## Global Constraints

- Team/player rating fields (`pace`, `shooting`, `passing`, `dribbling`, `defending`, `physical`, `teamStarRating`, `playerOverall`) must never be read by `computeMatchOdds` or anything it calls.
- No new `seed` column on `Match` — the seed string is derived on the fly from `match.id + homeTeamId + awayTeamId + kickoffTime.toISOString()`.
- `NOVELTY`, `FIGHT`, `LATE` markets keep their existing fixed odds — untouched by this plan.
- No new markets are added.
- Odds are still computed exactly once, at `createMatch` time, and never recalculated — existing matches' stored `Odds` rows are not touched or backfilled.
- Admin manual odds editing (`src/actions/odds.ts`) is unaffected — out of scope, not touched.
- All user-facing/comment text style in this codebase is technical and terse; match existing comment density in `src/lib/odds.ts`.

---

## File Structure

```
src/
  lib/
    odds.ts           # MODIFY: add hashSeed(), seed-derived RESULT/BTS/GOALS lambda pairs, new matchSeed param
  actions/
    matches.ts         # MODIFY: build matchSeed string, pass to computeMatchOdds
tests/
  odds.test.ts          # MODIFY: pass matchSeed to every computeMatchOdds() call, update band assertions, add determinism/seed-sensitivity/independence tests
```

No files are created; all three are existing files with existing responsibilities that this plan extends in place.

---

### Task 1: Seed hashing + RNG-driven lambda pairs in `odds.ts`

**Files:**
- Modify: `src/lib/odds.ts`
- Test: `tests/odds.test.ts`

**Interfaces:**
- Consumes: `mulberry32(seed: number): () => number` from `src/lib/horseRace.ts` (already exists, signature unchanged — import it, do not reimplement).
- Produces: `computeMatchOdds(homePlayerIds: string[], awayPlayerIds: string[], matchSeed: string, ouLine: number = DEFAULT_OU_LINE, htOuLine: number = DEFAULT_HT_OU_LINE): OddsRow[]` — `matchSeed` is a new **required** third positional parameter. `OddsRow` type is unchanged. This is the only exported symbol from this file; later tasks (Task 2, `matches.ts`) call it with this exact signature.

This task does all the `odds.ts` internals in one pass since the seed plumbing, the three lambda derivations, and the `computeBothTeamsScore` fix are not independently testable in isolation (they all change what `computeMatchOdds` returns for a given seed) — splitting them would leave a broken intermediate state that can't compile against the test file.

- [ ] **Step 1: Write the failing tests for the new signature and determinism**

Replace the first block of `tests/odds.test.ts` (the `describe('computeMatchOdds', ...)` opening and its fixed `odds` variable) so every existing call passes a seed, and add new tests. Full replacement of `tests/odds.test.ts` content:

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { computeMatchOdds } from '../src/lib/odds';

const SEED_A = 'match-a:team-h:team-a:2026-08-01T18:00:00.000Z';
const SEED_B = 'match-b:team-x:team-y:2026-08-02T19:30:00.000Z';

describe('computeMatchOdds', () => {
  const odds = computeMatchOdds(['p1', 'p2'], ['p3', 'p4'], SEED_A);

  it('produces exactly one odds row per 1X2 outcome', () => {
    const oneXTwo = odds.filter((o) => o.market === '1X2');
    expect(oneXTwo.map((o) => o.selectionKey).sort()).toEqual(['1', '2', 'X']);
  });

  it('keeps 1X2 odds in the calibrated close-match band (favored 2.44-2.58, draw 5.17-5.20, other 2.82-3.02)', () => {
    const oneXTwo = odds.filter((o) => o.market === '1X2');
    const draw = oneXTwo.find((o) => o.selectionKey === 'X')!;
    expect(draw.oddsValue).toBeGreaterThanOrEqual(5.17);
    expect(draw.oddsValue).toBeLessThanOrEqual(5.2);
    const sides = oneXTwo.filter((o) => o.selectionKey !== 'X').map((o) => o.oddsValue).sort((a, b) => a - b);
    const [favored, other] = sides;
    expect(favored).toBeGreaterThanOrEqual(2.44);
    expect(favored).toBeLessThanOrEqual(2.58);
    expect(other).toBeGreaterThanOrEqual(2.82);
    expect(other).toBeLessThanOrEqual(3.02);
  });

  it('produces an OU_GOALS row for the 9.5 line (hali saha runs high-scoring)', () => {
    const ou = odds.filter((o) => o.market === 'OU_GOALS');
    expect(ou.map((o) => o.selectionKey).sort()).toEqual(['OVER_9.5', 'UNDER_9.5']);
  });

  it('keeps the 9.5 goals line in the calibrated band (over 1.48-1.97, under 2.34-3.83)', () => {
    const ou = odds.filter((o) => o.market === 'OU_GOALS');
    const over = ou.find((o) => o.selectionKey === 'OVER_9.5')!;
    const under = ou.find((o) => o.selectionKey === 'UNDER_9.5')!;
    expect(over.oddsValue).toBeGreaterThanOrEqual(1.48);
    expect(over.oddsValue).toBeLessThanOrEqual(1.97);
    expect(under.oddsValue).toBeGreaterThanOrEqual(2.34);
    expect(under.oddsValue).toBeLessThanOrEqual(3.83);
  });

  it('keeps the HT 4.5 goals line in the calibrated band (over 1.56-1.91, under 2.43-3.42)', () => {
    const ht = odds.filter((o) => o.market === 'HT_OU_GOALS');
    const over = ht.find((o) => o.selectionKey === 'OVER_4.5')!;
    const under = ht.find((o) => o.selectionKey === 'UNDER_4.5')!;
    expect(over.oddsValue).toBeGreaterThanOrEqual(1.56);
    expect(over.oddsValue).toBeLessThanOrEqual(1.91);
    expect(under.oddsValue).toBeGreaterThanOrEqual(2.43);
    expect(under.oddsValue).toBeLessThanOrEqual(3.42);
  });

  it('produces SCORE odds covering 0-0 through at least 4-4', () => {
    const scores = odds.filter((o) => o.market === 'SCORE').map((o) => o.selectionKey);
    expect(scores).toContain('0-0');
    expect(scores).toContain('2-1');
    expect(scores).toContain('4-4');
  });

  it('produces PLAYER_GOALS 1+/2+ bands (no "0 goals" band) for every player passed in, within the calibrated range', () => {
    // This fixture uses 2 players per side (['p1','p2'] vs ['p3','p4']), not
    // the design spec's illustrative 5-player squad, so the per-player
    // lambda here is teamLambda/2 - numerically verified band for that
    // squad size (goals total 10.0-11.6, tilt 0-0.3, swept at step 0.001):
    // 1+ in [1.12, 1.18], 2+ in [1.32, 1.57].
    const playerMarkets = odds.filter((o) => o.market === 'PLAYER_GOALS');
    for (const pid of ['p1', 'p2', 'p3', 'p4']) {
      const onePlus = playerMarkets.find((o) => o.selectionKey === `${pid}:1+`);
      const twoPlus = playerMarkets.find((o) => o.selectionKey === `${pid}:2+`);
      expect(onePlus).toBeTruthy();
      expect(twoPlus).toBeTruthy();
      expect(onePlus!.oddsValue).toBeGreaterThanOrEqual(1.12);
      expect(onePlus!.oddsValue).toBeLessThanOrEqual(1.18);
      expect(twoPlus!.oddsValue).toBeGreaterThanOrEqual(1.32);
      expect(twoPlus!.oddsValue).toBeLessThanOrEqual(1.57);
      expect(playerMarkets.some((o) => o.selectionKey === `${pid}:0`)).toBe(false);
    }
  });

  it('all odds values are greater than 1.0 (no risk-free bets)', () => {
    expect(odds.every((o) => o.oddsValue > 1.0)).toBe(true);
  });

  it('produces a BTS (both teams to score) YES/NO pair in the calibrated band (YES 1.27-1.28, NO 6.48-6.79)', () => {
    const bts = odds.filter((o) => o.market === 'BTS');
    expect(bts.map((o) => o.selectionKey).sort()).toEqual(['NO', 'YES']);
    const yes = bts.find((o) => o.selectionKey === 'YES')!;
    const no = bts.find((o) => o.selectionKey === 'NO')!;
    expect(yes.oddsValue).toBeGreaterThanOrEqual(1.27);
    expect(yes.oddsValue).toBeLessThanOrEqual(1.28);
    expect(no.oddsValue).toBeGreaterThanOrEqual(6.48);
    expect(no.oddsValue).toBeLessThanOrEqual(6.79);
  });

  it('produces fixed-odds novelty markets for red card, pitch invasion, referee argument, and abandonment', () => {
    const novelty = odds.filter((o) => o.market === 'NOVELTY');
    expect(novelty.map((o) => o.selectionKey).sort()).toEqual([
      'MATCH_ABANDONED_NO',
      'MATCH_ABANDONED_YES',
      'PITCH_INVASION_NO',
      'PITCH_INVASION_YES',
      'RED_CARD_NO',
      'RED_CARD_YES',
      'REFEREE_ARGUMENT_NO',
      'REFEREE_ARGUMENT_YES',
    ]);
  });

  it('produces FIGHT and LATE markets for every player passed in', () => {
    const fight = odds.filter((o) => o.market === 'FIGHT');
    const late = odds.filter((o) => o.market === 'LATE');
    for (const pid of ['p1', 'p2', 'p3', 'p4']) {
      expect(fight.some((o) => o.selectionKey === `${pid}:YES`)).toBe(true);
      expect(fight.some((o) => o.selectionKey === `${pid}:NO`)).toBe(true);
      expect(late.some((o) => o.selectionKey === `${pid}:YES`)).toBe(true);
      expect(late.some((o) => o.selectionKey === `${pid}:NO`)).toBe(true);
    }
  });

  it('respects an admin-chosen OU line instead of the 9.5 default', () => {
    const customOdds = computeMatchOdds(['p1', 'p2'], ['p3', 'p4'], SEED_A, 12.5);
    const ou = customOdds.filter((o) => o.market === 'OU_GOALS');
    expect(ou.map((o) => o.selectionKey).sort()).toEqual(['OVER_12.5', 'UNDER_12.5']);
    for (const o of ou) {
      expect(o.oddsValue).toBeGreaterThan(1.0);
    }
  });

  it('is deterministic: the same matchSeed produces byte-identical odds on every call', () => {
    const first = computeMatchOdds(['p1', 'p2'], ['p3', 'p4'], SEED_A);
    const second = computeMatchOdds(['p1', 'p2'], ['p3', 'p4'], SEED_A);
    expect(second).toEqual(first);
  });

  it('is seed-sensitive: two different matchSeeds produce different 1X2 and BTS odds', () => {
    const oddsA = computeMatchOdds(['p1', 'p2'], ['p3', 'p4'], SEED_A);
    const oddsB = computeMatchOdds(['p1', 'p2'], ['p3', 'p4'], SEED_B);
    expect(oddsA.filter((o) => o.market === '1X2')).not.toEqual(oddsB.filter((o) => o.market === '1X2'));
    expect(oddsA.filter((o) => o.market === 'BTS')).not.toEqual(oddsB.filter((o) => o.market === 'BTS'));
  });

  it('keeps goal-tempo markets internally consistent: a seed producing a shorter OU_GOALS OVER price also produces a shorter PLAYER_GOALS 1+ price', () => {
    // Both derive from the same seed-drawn homeLambda/awayLambda pair, so a
    // "higher scoring" seed must push both markets the same direction.
    const oddsA = computeMatchOdds(['p1'], ['p2'], SEED_A);
    const oddsB = computeMatchOdds(['p1'], ['p2'], SEED_B);
    const overA = oddsA.find((o) => o.market === 'OU_GOALS' && o.selectionKey === 'OVER_9.5')!.oddsValue;
    const overB = oddsB.find((o) => o.market === 'OU_GOALS' && o.selectionKey === 'OVER_9.5')!.oddsValue;
    const p1PlusA = oddsA.find((o) => o.market === 'PLAYER_GOALS' && o.selectionKey === 'p1:1+')!.oddsValue;
    const p1PlusB = oddsB.find((o) => o.market === 'PLAYER_GOALS' && o.selectionKey === 'p1:1+')!.oddsValue;
    // Higher total-goal tempo -> OVER gets shorter (lower) odds and a
    // player's 1+ band also gets shorter (lower) odds. Same direction for
    // both, or equal if the two seeds happen to land on the same tempo.
    const overDirection = Math.sign(overA - overB);
    const playerDirection = Math.sign(p1PlusA - p1PlusB);
    expect(overDirection === 0 || playerDirection === 0 || overDirection === playerDirection).toBe(true);
  });

  it('never imports team/player rating helpers (rating independence)', () => {
    // Static guarantee: computeMatchOdds's only inputs are player ID lists
    // (used purely as row keys) and matchSeed/ouLine/htOuLine. This test
    // guards against a future edit accidentally wiring in team strength.
    const oddsPath = fileURLToPath(new URL('../src/lib/odds.ts', import.meta.url));
    const source = readFileSync(oddsPath, 'utf-8');
    expect(source).not.toMatch(/teamRating/);
    expect(source).not.toMatch(/playerOverall/);
    expect(source).not.toMatch(/teamStarRating/);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail (signature mismatch / wrong bands)**

Run: `npm test`
Expected: FAIL — TypeScript compile error, since `computeMatchOdds` doesn't yet accept a `matchSeed` third parameter (current signature is `(homePlayerIds, awayPlayerIds, ouLine?, htOuLine?)`).

- [ ] **Step 3: Implement seed hashing, RNG-driven lambda pairs, and the BTS fix in `odds.ts`**

First, add the import at the very top of `src/lib/odds.ts` (line 1, before the existing `OddsRow` type export):

```ts
import { mulberry32 } from './horseRace';
```

Then replace lines 39-42 of `src/lib/odds.ts` (the `RESULT_HOME_LAMBDA`/`RESULT_AWAY_LAMBDA`/`GOALS_HOME_LAMBDA`/`GOALS_AWAY_LAMBDA` constants and their comment block — these line numbers are unchanged by adding the import above, since that shifts everything down by one line; re-locate the block by its content, not the line number, if it drifted) with:

```ts
// hashSeed/mulberry32 turn a match's own identity string (id + team ids +
// kickoff time, built by the caller in src/actions/matches.ts) into a
// deterministic RNG. Same match -> same seed -> same odds forever. Team and
// player ratings are never read here - the whole point is a small, per-match
// variation that doesn't come from "who's stronger."
function hashSeed(input: string): number {
  let h = 2166136261; // FNV-1a 32-bit
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// RESULT_* drives the match-winner (1X2) market only. BTS_* drives
// both-teams-to-score only - it used to wrongly reuse RESULT_*, which gave a
// low, unrealistic KG Var probability (~37%) for a format where most matches
// see both sides score. GOALS_* drives every goal-count-based market (score
// grid, over/under, both half-time and full-match, per-player goal bands)
// from one shared per-match lambda pair, so they stay statistically
// consistent with each other - hali saha (5/7-a-side) matches run much
// higher-scoring than a full-size match, with blowouts (12-0, 14-2) common,
// so a 0-0 or 1-1 correctly gets very long odds here.
//
// All three pairs are derived from the same seeded RNG stream, drawn in a
// fixed order (RESULT sign, RESULT magnitude, BTS magnitude, GOALS total,
// GOALS magnitude) so a given matchSeed always reproduces the exact same
// three lambda pairs.
const RESULT_LAMBDA_BASE = 2.0;
const RESULT_TILT_MIN = 0.045; // floor: without it, tilt=0 collapses favored/other odds to the same value
const RESULT_TILT_MAX = 0.11;
const BTS_LAMBDA_BASE = 2.5;
const BTS_TILT_MAX = 0.3;
const GOALS_TOTAL_MIN = 10.0;
const GOALS_TOTAL_MAX = 11.6;
const GOALS_TILT_MAX = 0.3;

type LambdaPair = { home: number; away: number };

function deriveLambdas(matchSeed: string): { result: LambdaPair; bts: LambdaPair; goals: LambdaPair } {
  const rng = mulberry32(hashSeed(matchSeed));

  const sign = rng() < 0.5 ? 1 : -1; // which side is slightly favored, 50/50
  const resultMagnitude = RESULT_TILT_MIN + rng() * (RESULT_TILT_MAX - RESULT_TILT_MIN);
  const btsMagnitude = rng() * BTS_TILT_MAX;
  const goalsTotal = GOALS_TOTAL_MIN + rng() * (GOALS_TOTAL_MAX - GOALS_TOTAL_MIN);
  const goalsMagnitude = rng() * GOALS_TILT_MAX;

  return {
    result: { home: RESULT_LAMBDA_BASE + sign * resultMagnitude, away: RESULT_LAMBDA_BASE - sign * resultMagnitude },
    bts: { home: BTS_LAMBDA_BASE + sign * btsMagnitude, away: BTS_LAMBDA_BASE - sign * btsMagnitude },
    goals: { home: goalsTotal / 2 + sign * goalsMagnitude, away: goalsTotal / 2 - sign * goalsMagnitude },
  };
}
```

Then update every function that referenced the old module-level constants to instead take the relevant `LambdaPair` as a parameter:

```ts
function compute1X2(result: LambdaPair): OddsRow[] {
  let pHome = 0;
  let pDraw = 0;
  let pAway = 0;
  for (let h = 0; h <= MAX_GOALS_PER_SIDE; h++) {
    for (let a = 0; a <= MAX_GOALS_PER_SIDE; a++) {
      const p = poissonPmf(result.home, h) * poissonPmf(result.away, a);
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
```

```ts
function computeScores(goals: LambdaPair): OddsRow[] {
  const cells: { h: number; a: number; p: number }[] = [];
  for (let h = 0; h <= MAX_GOALS_PER_SIDE; h++) {
    for (let a = 0; a <= MAX_GOALS_PER_SIDE; a++) {
      cells.push({ h, a, p: poissonPmf(goals.home, h) * poissonPmf(goals.away, a) });
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
```

```ts
function computeOverUnder(goals: LambdaPair, ouLine: number): OddsRow[] {
  let pUnder = 0;
  for (let h = 0; h <= OU_MAX_GOALS_PER_SIDE; h++) {
    for (let a = 0; a <= OU_MAX_GOALS_PER_SIDE; a++) {
      if (h + a < ouLine) pUnder += poissonPmf(goals.home, h) * poissonPmf(goals.away, a);
    }
  }
  const pOver = 1 - pUnder;
  return [
    { market: 'OU_GOALS', selectionKey: `OVER_${ouLine}`, oddsValue: oddsFromProbability(pOver) },
    { market: 'OU_GOALS', selectionKey: `UNDER_${ouLine}`, oddsValue: oddsFromProbability(pUnder) },
  ];
}
```

```ts
// First-half total goals - modeled as half the full-match lambda, on the
// simplifying assumption that goals split roughly evenly across the two
// halves.
function computeHalfTimeOverUnder(goals: LambdaPair, htOuLine: number): OddsRow[] {
  const htHomeLambda = goals.home / 2;
  const htAwayLambda = goals.away / 2;
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
```

```ts
function computeBothTeamsScore(bts: LambdaPair): OddsRow[] {
  let pBothScore = 0;
  for (let h = 1; h <= MAX_GOALS_PER_SIDE; h++) {
    for (let a = 1; a <= MAX_GOALS_PER_SIDE; a++) {
      pBothScore += poissonPmf(bts.home, h) * poissonPmf(bts.away, a);
    }
  }
  const pNoBothScore = 1 - pBothScore;
  return [
    { market: 'BTS', selectionKey: 'YES', oddsValue: oddsFromProbability(pBothScore) },
    { market: 'BTS', selectionKey: 'NO', oddsValue: oddsFromProbability(pNoBothScore) },
  ];
}
```

```ts
function computePlayerGoals(homePlayerIds: string[], awayPlayerIds: string[], goals: LambdaPair): OddsRow[] {
  const rows: OddsRow[] = [];
  const sides: [string[], number][] = [
    [homePlayerIds, goals.home],
    [awayPlayerIds, goals.away],
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
```

Finally, replace the exported `computeMatchOdds` function:

```ts
export function computeMatchOdds(
  homePlayerIds: string[],
  awayPlayerIds: string[],
  matchSeed: string,
  ouLine: number = DEFAULT_OU_LINE,
  htOuLine: number = DEFAULT_HT_OU_LINE
): OddsRow[] {
  const { result, bts, goals } = deriveLambdas(matchSeed);
  return [
    ...compute1X2(result),
    ...computeScores(goals),
    ...computeOverUnder(goals, ouLine),
    ...computeHalfTimeOverUnder(goals, htOuLine),
    ...computeBothTeamsScore(bts),
    ...computeNoveltyMarkets(),
    ...computePlayerNoveltyMarkets(homePlayerIds, awayPlayerIds),
    ...computePlayerGoals(homePlayerIds, awayPlayerIds, goals),
  ];
}
```

`computeNoveltyMarkets` and `computePlayerNoveltyMarkets` are unchanged (fixed odds, no lambda input) — leave them exactly as-is.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS — all tests in `tests/odds.test.ts` green, including the new determinism, seed-sensitivity, cross-market consistency, and rating-independence tests.

- [ ] **Step 5: Commit**

```bash
cd "C:\FERRARI\iddaa-saha-odds-fix"
git add src/lib/odds.ts tests/odds.test.ts
git commit -m "feat: derive per-match odds variation from a deterministic match seed

Adds matchSeed as a required third param to computeMatchOdds. RESULT
(1X2), BTS (KG Var/Yok), and GOALS (SCORE/OU/HT_OU/PLAYER_GOALS) each
get their own lambda pair drawn from one seeded RNG stream (mulberry32,
reused from horseRace.ts), so the same match always produces the same
odds and different matches get small, bounded variation. Also fixes
computeBothTeamsScore() reusing the low-scoring RESULT_* lambda pair
instead of a properly calibrated high-scoring BTS pair.

No team or player rating field is read anywhere in this module.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2: Build and pass `matchSeed` from `createMatch`

**Files:**
- Modify: `src/actions/matches.ts`

**Interfaces:**
- Consumes: `computeMatchOdds(homePlayerIds: string[], awayPlayerIds: string[], matchSeed: string, ouLine?: number, htOuLine?: number): OddsRow[]` from Task 1.
- Produces: nothing new consumed by later tasks — this is the last task in this plan.

There's no isolated unit test for this one-line change inside a server action that also touches Prisma (the existing test suite for this file, if any, is out of scope of this plan — `matches.ts` has no dedicated test file today). Verification is a manual `tsc`/build check plus running the full `npm test` suite to make sure nothing else broke.

- [ ] **Step 1: Add the `matchSeed` construction and pass it through**

In `src/actions/matches.ts`, locate the existing block (around line 52):

```ts
  const oddsRows = computeMatchOdds(
    homePlayers.map((p) => p.id),
    awayPlayers.map((p) => p.id),
    ouLine,
    htOuLine
  );
```

Replace it with:

```ts
  const matchSeed = `${match.id}:${homeTeamId}:${awayTeamId}:${kickoffTime.toISOString()}`;
  const oddsRows = computeMatchOdds(
    homePlayers.map((p) => p.id),
    awayPlayers.map((p) => p.id),
    matchSeed,
    ouLine,
    htOuLine
  );
```

This sits after `const match = await prisma.match.create(...)` (so `match.id` exists) and before the `computeMatchOdds` call, matching the design spec's "API Değişikliği" section exactly.

- [ ] **Step 2: Type-check the whole project**

Run: `npx tsc --noEmit`
Expected: no errors. This confirms `createMatch`'s call site now matches the new `computeMatchOdds` signature and nothing else in the codebase called the old 2-arg/3-arg-without-seed form.

- [ ] **Step 3: Run the full test suite**

Run: `npm test`
Expected: PASS — same result as Task 1 Step 4 (this task doesn't change `odds.ts` or its tests, just one caller), confirming the wiring didn't regress anything.

- [ ] **Step 4: Commit**

```bash
cd "C:\FERRARI\iddaa-saha-odds-fix"
git add src/actions/matches.ts
git commit -m "feat: pass a per-match deterministic seed into computeMatchOdds

Builds matchSeed from match.id + team ids + kickoff time (all already
available before computeMatchOdds is called) and passes it through, as
specced in docs/superpowers/specs/2026-07-29-hali-saha-odds-seed-design.md.
No schema change - the seed is derived on the fly, never stored.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Post-Plan Manual Verification

Not a task with its own commit — a final sanity pass after both tasks land, per the design spec's "Test Stratejisi" closing note:

- [ ] Run `npm test` once more from a clean state to confirm both tasks together leave the suite green.
- [ ] In a scratch script or REPL, call `computeMatchOdds(['p1','p2'],['p3','p4'], 'sim-match-1:teamA:teamB:2026-08-01T18:00:00.000Z')` and `computeMatchOdds(['p1','p2'],['p3','p4'], 'sim-match-2:teamC:teamD:2026-08-03T20:00:00.000Z')`, print both 1X2 and BTS rows, and visually confirm the two simulated matches read as "two different but plausible matches" (different favored side or different margins), not "same numbers every time."
