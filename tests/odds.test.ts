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

  it('produces an OU_GOALS row for the 4.5 line', () => {
    const ou = odds.filter((o) => o.market === 'OU_GOALS');
    expect(ou.map((o) => o.selectionKey).sort()).toEqual(['OVER_4.5', 'UNDER_4.5']);
  });

  it('produces SCORE odds covering 0-0 through at least 4-4', () => {
    const scores = odds.filter((o) => o.market === 'SCORE').map((o) => o.selectionKey);
    expect(scores).toContain('0-0');
    expect(scores).toContain('2-1');
    expect(scores).toContain('4-4');
  });

  it('produces PLAYER_GOALS bands for every player passed in', () => {
    const playerMarkets = odds.filter((o) => o.market === 'PLAYER_GOALS');
    for (const pid of ['p1', 'p2', 'p3', 'p4']) {
      expect(playerMarkets.some((o) => o.selectionKey.startsWith(`${pid}:`))).toBe(true);
    }
  });

  it('all odds values are greater than 1.0 (no risk-free bets)', () => {
    expect(odds.every((o) => o.oddsValue > 1.0)).toBe(true);
  });
});
