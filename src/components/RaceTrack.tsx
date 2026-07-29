'use client';

import { useEffect, useRef, useState } from 'react';
import { winProbabilities, mulberry32, drawFinishOrder } from '@/lib/horseRace';
import type { RaceEntryView } from '@/lib/horseRaceEngine';

export default function RaceTrack({
  entries,
  phase,
  bettingEndsAt,
  raceEndsAt,
  seed,
}: {
  entries: RaceEntryView[];
  phase: 'BETTING' | 'RACING' | 'FINISHED';
  bettingEndsAt: string;
  raceEndsAt: string;
  seed: number;
}) {
  const [positions, setPositions] = useState<Record<string, number>>({});
  const frameRef = useRef<number | null>(null);

  // The finish order is fully determined by (entries' ratings, seed) — the
  // exact same pure functions the server uses at settlement (Task 3). This
  // lets every viewer's browser independently compute the same race outcome
  // without any realtime push channel.
  const finishOrder = drawFinishOrder(
    entries.map((e) => e.horseId),
    winProbabilities(entries),
    mulberry32(seed)
  );
  const rankByHorseId = new Map(finishOrder.map((id, i) => [id, i]));

  useEffect(() => {
    if (phase !== 'RACING') {
      if (phase === 'FINISHED') {
        const finished: Record<string, number> = {};
        for (const e of entries) finished[e.horseId] = rankByHorseId.get(e.horseId) === 0 ? 1 : 0.95;
        setPositions(finished);
      } else {
        setPositions({});
      }
      return;
    }

    const start = new Date(bettingEndsAt).getTime();
    const end = new Date(raceEndsAt).getTime();
    const totalMs = end - start;
    const rng = mulberry32(seed + 1000); // separate stream from the outcome draw, used only for visual jitter

    // Give each horse a fixed jitter frequency/phase so its wobble looks
    // organic but stays stable frame to frame (not re-randomized every tick).
    const jitterParams = entries.map(() => ({ freq: 4 + rng() * 4, phase: rng() * Math.PI * 2 }));

    function tick() {
      const now = Date.now();
      const t = Math.max(0, Math.min(1, (now - start) / totalMs));
      const next: Record<string, number> = {};
      entries.forEach((e, i) => {
        const rank = rankByHorseId.get(e.horseId) ?? entries.length - 1;
        const rankPenalty = rank * 0.025; // winner (rank 0) has no penalty, each place behind trails a bit more
        const { freq, phase: ph } = jitterParams[i];
        const jitter = 0.015 * Math.sin(freq * t * Math.PI * 2 + ph);
        next[e.horseId] = Math.max(0, Math.min(1, t * (1 - rankPenalty) + jitter));
      });
      setPositions(next);
      if (t < 1) frameRef.current = requestAnimationFrame(tick);
    }
    frameRef.current = requestAnimationFrame(tick);

    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, bettingEndsAt, raceEndsAt, seed]);

  return (
    <div className="flex flex-col gap-1 rounded-xl border border-line bg-pitch-night-raised p-3">
      {entries.map((e) => (
        <div key={e.horseId} className="relative h-8 rounded-lg bg-pitch-night">
          <div className="absolute right-1 top-1/2 h-px w-2 -translate-y-1/2 bg-gold" />
          <div
            className="absolute top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-xs font-bold text-pitch-night transition-[left] duration-100 ease-linear"
            style={{ left: `calc(${(positions[e.horseId] ?? 0) * 92}% )`, backgroundColor: e.color }}
          >
            {e.number ?? ''}
          </div>
        </div>
      ))}
    </div>
  );
}
