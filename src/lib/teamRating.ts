type RatedPlayer = {
  pace: number | null;
  shooting: number | null;
  passing: number | null;
  dribbling: number | null;
  defending: number | null;
  physical: number | null;
};

export function playerOverall(p: RatedPlayer): number | null {
  const values = [p.pace, p.shooting, p.passing, p.dribbling, p.defending, p.physical].filter(
    (v): v is number => v !== null
  );
  if (values.length === 0) return null;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

// Averages each rated player's 1-99 overall, then maps it onto a 1-5 star scale (nearest half-star).
export function teamStarRating(players: RatedPlayer[]): number | null {
  const overalls = players.map(playerOverall).filter((v): v is number => v !== null);
  if (overalls.length === 0) return null;
  const avgOverall = overalls.reduce((a, b) => a + b, 0) / overalls.length;
  const stars = Math.max(1, Math.min(5, avgOverall / 20));
  return Math.round(stars * 2) / 2;
}
