export type HorseAttributes = { speedRating: number; formRating: number; luckRating: number };

const SPEED_WEIGHT = 0.45;
const FORM_WEIGHT = 0.35;
const LUCK_WEIGHT = 0.2;

// Softmax temperature: higher = flatter distribution (favorites and
// longshots closer together), lower = sharper (favorites dominate more).
// 3.0 keeps the spread realistic without ever making a longshot a lock.
const SOFTMAX_TEMPERATURE = 3.0;

// Same "house margin multiplies the fair odds up" convention as
// src/lib/odds.ts's HOUSE_MARGIN — kept consistent across both betting
// systems on this site rather than editorializing a "correct" direction here.
const HOUSE_MARGIN = 1.08;
const MIN_ODDS = 1.3;
const MAX_ODDS = 15;

export function compositeScore(h: HorseAttributes): number {
  return SPEED_WEIGHT * h.speedRating + FORM_WEIGHT * h.formRating + LUCK_WEIGHT * h.luckRating;
}

export function winProbabilities(horses: HorseAttributes[]): number[] {
  const scaled = horses.map((h) => compositeScore(h) / SOFTMAX_TEMPERATURE);
  const max = Math.max(...scaled);
  const exps = scaled.map((s) => Math.exp(s - max)); // subtract max for numerical stability
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sum);
}

export function oddsFromProbabilities(probabilities: number[]): number[] {
  return probabilities.map((p) => {
    const raw = (1 / p) * HOUSE_MARGIN;
    const clamped = Math.min(MAX_ODDS, Math.max(MIN_ODDS, raw));
    return Math.round(clamped * 100) / 100;
  });
}

// Deterministic PRNG (mulberry32) — needed because Math.random() can't be
// seeded, and the whole point here is that the server (at settlement) and
// every client (during the live animation) derive the exact same finish
// order from the same stored seed, with no realtime channel between them.
export function mulberry32(seed: number): () => number {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Weighted draw without replacement: repeatedly picks a "next finisher" from
// the remaining field, weighted by their win probability. Index 0 of the
// result is the winner.
export function drawFinishOrder(horseIds: string[], probabilities: number[], rng: () => number): string[] {
  const remaining = horseIds.map((id, i) => ({ id, weight: probabilities[i] }));
  const order: string[] = [];
  while (remaining.length > 0) {
    const totalWeight = remaining.reduce((s, r) => s + r.weight, 0);
    let roll = rng() * totalWeight;
    let chosenIdx = remaining.length - 1;
    for (let i = 0; i < remaining.length; i++) {
      roll -= remaining[i].weight;
      if (roll <= 0) {
        chosenIdx = i;
        break;
      }
    }
    order.push(remaining[chosenIdx].id);
    remaining.splice(chosenIdx, 1);
  }
  return order;
}
