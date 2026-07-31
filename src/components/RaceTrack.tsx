'use client';

import { useEffect, useRef } from 'react';
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
  const frameRef = useRef<number | null>(null);
  const runnerRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const badgeRefs = useRef<Record<string, HTMLDivElement | null>>({});

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
    // Never move a runner through React state. On mobile, rendering a whole
    // component tree at rAF cadence while also changing `left` (a layout
    // property) can defer paints under touch pressure; the deferred paint is
    // then perceived as "the horses moved when I touched the screen". Direct
    // transform updates keep the work on the compositor and do not depend on
    // touch/click events or parent re-renders.
    function setRunnerPosition(horseId: string, progress: number) {
      const runner = runnerRefs.current[horseId];
      if (runner) runner.style.transform = `translate3d(${progress * 100}%, 0, 0)`;
    }

    if (phase !== 'RACING') {
      if (phase === 'FINISHED') {
        const winnerId = finishOrder[0];
        for (const entry of entries) {
          setRunnerPosition(entry.horseId, rankByHorseId.get(entry.horseId) === 0 ? 1 : 0.95);
          const badge = badgeRefs.current[entry.horseId];
          if (badge) badge.classList.toggle('jackpot-pulse', entry.horseId === winnerId);
        }
      } else {
        for (const entry of entries) {
          setRunnerPosition(entry.horseId, 0);
          const badge = badgeRefs.current[entry.horseId];
          if (badge) badge.classList.remove('jackpot-pulse');
        }
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
      entries.forEach((entry, i) => {
        const rank = rankByHorseId.get(entry.horseId) ?? entries.length - 1;
        const rankPenalty = rank * 0.025; // winner (rank 0) has no penalty, each place behind trails a bit more
        const { freq, phase: jitterPhase } = jitterParams[i];
        const jitter = 0.015 * Math.sin(freq * t * Math.PI * 2 + jitterPhase);
        setRunnerPosition(entry.horseId, Math.max(0, Math.min(1, t * (1 - rankPenalty) + jitter)));
      });
      if (t < 1) frameRef.current = requestAnimationFrame(tick);
    }
    frameRef.current = requestAnimationFrame(tick);

    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
    // A new race necessarily has a new timestamp/seed. Depending on `entries`
    // would restart this effect every time the two-second polling response
    // creates a fresh array, which would be exactly the visual reset to avoid.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, bettingEndsAt, raceEndsAt, seed]);

  return (
    <div className="flex flex-col gap-1 rounded-xl border border-line bg-pitch-night-raised p-3">
      {entries.map((entry) => (
        <div key={entry.horseId} className="relative h-8 overflow-hidden rounded-lg bg-pitch-night">
          <div className="absolute right-1 top-1/2 h-px w-2 -translate-y-1/2 bg-gold" />
          <div
            ref={(node) => {
              runnerRefs.current[entry.horseId] = node;
            }}
            className="absolute inset-y-0 left-0 w-[calc(100%-1.5rem)] will-change-transform"
          >
            <div
              ref={(node) => {
                badgeRefs.current[entry.horseId] = node;
              }}
              className="absolute top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-xs font-bold text-pitch-night"
              style={{ backgroundColor: entry.color }}
            >
              {entry.number ?? ''}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
