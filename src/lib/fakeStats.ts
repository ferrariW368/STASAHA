// Deterministic (seeded by matchId) fake match statistics - purely for flavor,
// never real tracked data. Biased toward the winning team roughly in
// proportion to the goal margin, per team's mood.
function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function seededRandom(seed: number) {
  let state = seed || 1;
  return function next() {
    state = (Math.imul(state, 1103515245) + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
}

export type FakeMatchStats = {
  possession: [number, number];
  shots: [number, number];
  shotsOnTarget: [number, number];
  corners: [number, number];
  duelsWon: [number, number];
  aerialDuelsWon: [number, number];
  offsides: [number, number];
};

export function generateFakeStats(matchId: string, homeScore: number, awayScore: number): FakeMatchStats {
  const rand = seededRandom(hashString(matchId));
  const margin = homeScore - awayScore;
  const dominance = Math.max(-20, Math.min(20, margin * 4)); // how lopsided the game "felt"

  const possHome = Math.round(Math.max(28, Math.min(72, 50 + dominance + (rand() * 6 - 3))));
  const possession: [number, number] = [possHome, 100 - possHome];

  function skewedPair(base: number, jitter: number): [number, number] {
    const homeBase = base + Math.max(0, dominance) * 0.4 + homeScore * 1.5;
    const awayBase = base + Math.max(0, -dominance) * 0.4 + awayScore * 1.5;
    const home = Math.max(homeScore, Math.round(homeBase + (rand() * jitter - jitter / 2)));
    const away = Math.max(awayScore, Math.round(awayBase + (rand() * jitter - jitter / 2)));
    return [home, away];
  }

  const shots = skewedPair(6, 4);
  const shotsOnTarget: [number, number] = [
    Math.max(homeScore, Math.round(shots[0] * (0.45 + rand() * 0.15))),
    Math.max(awayScore, Math.round(shots[1] * (0.45 + rand() * 0.15))),
  ];
  const corners = skewedPair(3, 3);
  const duelsWon = skewedPair(15, 6);
  const aerialDuelsWon = skewedPair(6, 4);
  const offsides: [number, number] = [Math.round(rand() * 3), Math.round(rand() * 3)];

  return { possession, shots, shotsOnTarget, corners, duelsWon, aerialDuelsWon, offsides };
}
