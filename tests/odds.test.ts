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
