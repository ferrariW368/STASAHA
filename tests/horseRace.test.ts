import { describe, it, expect } from 'vitest';
import { compositeScore, winProbabilities, oddsFromProbabilities, mulberry32, drawFinishOrder, simulatedBetCount } from '../src/lib/horseRace';

describe('compositeScore', () => {
  it('weighs speed highest, then form, then luck', () => {
    const fast = compositeScore({ speedRating: 10, formRating: 1, luckRating: 1 });
    const inForm = compositeScore({ speedRating: 1, formRating: 10, luckRating: 1 });
    const lucky = compositeScore({ speedRating: 1, formRating: 1, luckRating: 10 });
    expect(fast).toBeGreaterThan(inForm);
    expect(inForm).toBeGreaterThan(lucky);
  });
});

describe('winProbabilities', () => {
  it('sums to 1 across the field', () => {
    const horses = [
      { speedRating: 8, formRating: 6, luckRating: 5 },
      { speedRating: 5, formRating: 5, luckRating: 5 },
      { speedRating: 3, formRating: 4, luckRating: 9 },
    ];
    const probs = winProbabilities(horses);
    expect(probs.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 5);
  });

  it('gives the strongest horse the highest probability', () => {
    const horses = [
      { speedRating: 9, formRating: 9, luckRating: 5 },
      { speedRating: 3, formRating: 3, luckRating: 5 },
    ];
    const probs = winProbabilities(horses);
    expect(probs[0]).toBeGreaterThan(probs[1]);
  });

  it('gives identical horses identical probability', () => {
    const horses = [
      { speedRating: 5, formRating: 5, luckRating: 5 },
      { speedRating: 5, formRating: 5, luckRating: 5 },
    ];
    const probs = winProbabilities(horses);
    expect(probs[0]).toBeCloseTo(probs[1], 10);
  });
});

describe('oddsFromProbabilities', () => {
  it('gives lower odds to higher-probability horses', () => {
    const odds = oddsFromProbabilities([0.5, 0.1]);
    expect(odds[0]).toBeLessThan(odds[1]);
  });

  it('clamps every value into [1.3, 15]', () => {
    const odds = oddsFromProbabilities([0.99, 0.001]);
    for (const o of odds) {
      expect(o).toBeGreaterThanOrEqual(1.3);
      expect(o).toBeLessThanOrEqual(15);
    }
  });
});

describe('mulberry32', () => {
  it('is deterministic: same seed produces the same sequence', () => {
    const rngA = mulberry32(42);
    const rngB = mulberry32(42);
    const seqA = [rngA(), rngA(), rngA()];
    const seqB = [rngB(), rngB(), rngB()];
    expect(seqA).toEqual(seqB);
  });

  it('produces values in [0, 1)', () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 20; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('drawFinishOrder', () => {
  it('returns every horse id exactly once', () => {
    const ids = ['a', 'b', 'c', 'd'];
    const order = drawFinishOrder(ids, [0.4, 0.3, 0.2, 0.1], mulberry32(1));
    expect([...order].sort()).toEqual([...ids].sort());
  });

  it('is deterministic for a fixed seed', () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    const probs = [0.3, 0.2, 0.15, 0.15, 0.1, 0.05, 0.05];
    const orderA = drawFinishOrder(ids, probs, mulberry32(123));
    const orderB = drawFinishOrder(ids, probs, mulberry32(123));
    expect(orderA).toEqual(orderB);
  });

  it('picks the winner from the weighted distribution over many trials (statistical, not exact)', () => {
    const ids = ['strong', 'weak'];
    const probs = [0.9, 0.1];
    let strongWins = 0;
    for (let seed = 0; seed < 200; seed++) {
      const order = drawFinishOrder(ids, probs, mulberry32(seed));
      if (order[0] === 'strong') strongWins++;
    }
    expect(strongWins).toBeGreaterThan(140); // expect roughly 90% x 200 = 180, allow generous margin
  });
});

describe('simulatedBetCount', () => {
  it('returns 0 once real betting volume reaches the threshold', () => {
    const rng = mulberry32(1);
    expect(simulatedBetCount(5, 2.0, rng)).toBe(0);
    expect(simulatedBetCount(9, 2.0, rng)).toBe(0);
  });

  it('returns an integer in [0, 4] below the threshold', () => {
    const rng = mulberry32(2);
    for (let i = 0; i < 50; i++) {
      const n = simulatedBetCount(0, 3.0, rng);
      expect(Number.isInteger(n)).toBe(true);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThanOrEqual(4);
    }
  });

  it('favors lower odds (favorites) with a higher expected boost than longshots', () => {
    const trials = 300;
    let favoriteSum = 0;
    let longshotSum = 0;
    const favoriteRng = mulberry32(10);
    const longshotRng = mulberry32(10);
    for (let i = 0; i < trials; i++) {
      favoriteSum += simulatedBetCount(0, 1.3, favoriteRng);
      longshotSum += simulatedBetCount(0, 15, longshotRng);
    }
    expect(favoriteSum / trials).toBeGreaterThan(longshotSum / trials);
  });

  it('is deterministic for a fixed rng sequence', () => {
    const seqA: number[] = [];
    const rngA = mulberry32(42);
    for (let i = 0; i < 5; i++) seqA.push(simulatedBetCount(0, 2.5, rngA));

    const seqB: number[] = [];
    const rngB = mulberry32(42);
    for (let i = 0; i < 5; i++) seqB.push(simulatedBetCount(0, 2.5, rngB));

    expect(seqA).toEqual(seqB);
  });
});
