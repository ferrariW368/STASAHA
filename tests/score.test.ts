import { describe, it, expect } from 'vitest';
import { computeUserScore } from '../src/lib/score';

describe('computeUserScore', () => {
  it('matches the "won 150, lost 200 -> -50" example', () => {
    const bets = [
      { status: 'won', stake: 100, potentialWin: 250 }, // net win: 150
      { status: 'lost', stake: 200, potentialWin: 0 },
    ];
    const score = computeUserScore(bets);
    expect(score.won).toBe(150);
    expect(score.lost).toBe(200);
    expect(score.net).toBe(-50);
  });

  it('ignores pending and refunded bets', () => {
    const bets = [
      { status: 'pending', stake: 100, potentialWin: 300 },
      { status: 'refunded', stake: 50, potentialWin: 0 },
    ];
    expect(computeUserScore(bets)).toEqual({ won: 0, lost: 0, net: 0 });
  });

  it('sums across multiple won and lost bets', () => {
    const bets = [
      { status: 'won', stake: 100, potentialWin: 200 }, // +100
      { status: 'won', stake: 50, potentialWin: 300 }, // +250
      { status: 'lost', stake: 30, potentialWin: 0 },
      { status: 'lost', stake: 20, potentialWin: 0 },
    ];
    const score = computeUserScore(bets);
    expect(score.won).toBe(350);
    expect(score.lost).toBe(50);
    expect(score.net).toBe(300);
  });
});
