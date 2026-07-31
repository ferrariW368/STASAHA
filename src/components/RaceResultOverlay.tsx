'use client';

import { useEffect } from 'react';
import confetti from 'canvas-confetti';

export type RaceOverlayResult = {
  status: 'won' | 'lost';
  horseName: string;
  stake: number;
  potentialWin: number;
  winningHorseName: string;
};

export default function RaceResultOverlay({
  result,
  onDismiss,
}: {
  result: RaceOverlayResult;
  onDismiss: () => void;
}) {
  useEffect(() => {
    if (result.status !== 'won') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    confetti({
      particleCount: 120,
      spread: 80,
      origin: { y: 0.7 },
      colors: ['#dc0000', '#e8b923', '#ffffff'],
    });
  }, [result.status]);

  const won = result.status === 'won';
  const net = result.potentialWin - result.stake;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-pitch-night/80 px-4">
      <div className="overlay-pop-in w-full max-w-xs rounded-2xl border border-line bg-pitch-night-raised p-6 text-center shadow-lg">
        {won ? (
          <>
            <p className="font-display text-3xl tracking-wide text-gold">🎉 Kazandın!</p>
            <p className="mt-2 text-sm text-text-primary">#{result.horseName} birinci geldi.</p>
            <p className="mt-4 font-display text-2xl text-grass">+{net} STA</p>
          </>
        ) : (
          <>
            <p className="font-display text-3xl tracking-wide text-text-primary">Bu sefer olmadı</p>
            <p className="mt-2 text-sm text-text-muted">
              Senin atın: {result.horseName}
              <br />
              Kazanan: {result.winningHorseName}
            </p>
            <p className="mt-4 text-sm text-text-muted">-{result.stake} STA</p>
          </>
        )}
        <button
          onClick={onDismiss}
          className="pop-interactive mt-6 w-full rounded-full bg-gold py-2.5 text-sm font-semibold text-pitch-night"
        >
          Devam Et
        </button>
      </div>
    </div>
  );
}
