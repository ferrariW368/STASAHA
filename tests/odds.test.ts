import { describe, it, expect } from 'vitest';
import { computeMatchOdds } from '../src/lib/odds';

describe('computeMatchOdds', () => {
  const odds = computeMatchOdds(['p1', 'p2'], ['p3', 'p4']);

  it('produces exactly one odds row per 1X2 outcome', () => {
    const oneXTwo = odds.filter((o) => o.market === '1X2');
    expect(oneXTwo.map((o) => o.selectionKey).sort()).toEqual(['1', '2', 'X']);
  });

  it('gives the home side a shorter (lower) odds than the draw', () => {
    const home = odds.find((o) => o.market === '1X2' && o.selectionKey === '1')!;
    const draw = odds.find((o) => o.market === '1X2' && o.selectionKey === 'X')!;
    expect(home.oddsValue).toBeLessThan(draw.oddsValue);
  });

  it('keeps 1X2 odds in a realistic close-match range (no side is a lock or a lottery ticket)', () => {
    const oneXTwo = odds.filter((o) => o.market === '1X2');
    for (const o of oneXTwo) {
      expect(o.oddsValue).toBeGreaterThan(2.0);
      expect(o.oddsValue).toBeLessThan(5.0);
    }
  });

  it('produces an OU_GOALS row for the 9.5 line (hali saha runs high-scoring)', () => {
    const ou = odds.filter((o) => o.market === 'OU_GOALS');
    expect(ou.map((o) => o.selectionKey).sort()).toEqual(['OVER_9.5', 'UNDER_9.5']);
  });

  it('keeps the 9.5 goals line close to a 50/50 split', () => {
    const ou = odds.filter((o) => o.market === 'OU_GOALS');
    for (const o of ou) {
      expect(o.oddsValue).toBeGreaterThan(1.5);
      expect(o.oddsValue).toBeLessThan(3.0);
    }
  });

  it('produces SCORE odds covering 0-0 through at least 4-4', () => {
    const scores = odds.filter((o) => o.market === 'SCORE').map((o) => o.selectionKey);
    expect(scores).toContain('0-0');
    expect(scores).toContain('2-1');
    expect(scores).toContain('4-4');
  });

  it('produces PLAYER_GOALS 1+/2+ bands (no "0 goals" band) for every player passed in', () => {
    const playerMarkets = odds.filter((o) => o.market === 'PLAYER_GOALS');
    for (const pid of ['p1', 'p2', 'p3', 'p4']) {
      expect(playerMarkets.some((o) => o.selectionKey === `${pid}:1+`)).toBe(true);
      expect(playerMarkets.some((o) => o.selectionKey === `${pid}:2+`)).toBe(true);
      expect(playerMarkets.some((o) => o.selectionKey === `${pid}:0`)).toBe(false);
    }
  });

  it('all odds values are greater than 1.0 (no risk-free bets)', () => {
    expect(odds.every((o) => o.oddsValue > 1.0)).toBe(true);
  });

  it('produces a BTS (both teams to score) YES/NO pair with non-extreme odds', () => {
    const bts = odds.filter((o) => o.market === 'BTS');
    expect(bts.map((o) => o.selectionKey).sort()).toEqual(['NO', 'YES']);
    for (const o of bts) {
      expect(o.oddsValue).toBeGreaterThan(1.3);
      expect(o.oddsValue).toBeLessThan(6.0);
    }
  });

  it('produces fixed-odds novelty markets for red card and pitch invasion', () => {
    const novelty = odds.filter((o) => o.market === 'NOVELTY');
    expect(novelty.map((o) => o.selectionKey).sort()).toEqual([
      'PITCH_INVASION_NO',
      'PITCH_INVASION_YES',
      'RED_CARD_NO',
      'RED_CARD_YES',
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
    const customOdds = computeMatchOdds(['p1', 'p2'], ['p3', 'p4'], 12.5);
    const ou = customOdds.filter((o) => o.market === 'OU_GOALS');
    expect(ou.map((o) => o.selectionKey).sort()).toEqual(['OVER_12.5', 'UNDER_12.5']);
    for (const o of ou) {
      expect(o.oddsValue).toBeGreaterThan(1.0);
    }
  });
});
