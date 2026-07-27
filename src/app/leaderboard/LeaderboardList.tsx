'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';

export type RankedUser = {
  username: string;
  staBalance: number;
  total: number;
  winRate: number;
  score: { won: number; lost: number; net: number };
};

const POLL_MS = 20000;

export default function LeaderboardList({ initial }: { initial: RankedUser[] }) {
  const [ranked, setRanked] = useState(initial);
  const rowRefs = useRef(new Map<string, HTMLLIElement>());
  const prevRects = useRef(new Map<string, DOMRect>());
  const reducedMotion = useRef(false);

  useEffect(() => {
    reducedMotion.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  useEffect(() => {
    const interval = setInterval(async () => {
      // FLIP "First": capture current row positions before the reorder.
      const rects = new Map<string, DOMRect>();
      rowRefs.current.forEach((el, username) => rects.set(username, el.getBoundingClientRect()));
      prevRects.current = rects;

      try {
        const res = await fetch('/api/leaderboard');
        if (!res.ok) return;
        const data: RankedUser[] = await res.json();
        setRanked(data);
      } catch {
        // network hiccup — just skip this tick, next poll retries
      }
    }, POLL_MS);
    return () => clearInterval(interval);
  }, []);

  useLayoutEffect(() => {
    if (reducedMotion.current) return;
    // FLIP "Last" + "Invert" + "Play": diff new positions against the
    // captured ones and animate from the old delta back to zero.
    rowRefs.current.forEach((el, username) => {
      const first = prevRects.current.get(username);
      if (!first) return;
      const last = el.getBoundingClientRect();
      const dy = first.top - last.top;
      if (dy === 0) return;
      el.style.transition = 'none';
      el.style.transform = `translateY(${dy}px)`;
      requestAnimationFrame(() => {
        el.style.transition = 'transform 400ms ease-out';
        el.style.transform = 'translateY(0)';
      });
    });
  }, [ranked]);

  return (
    <ol className="mb-4 flex flex-col gap-2">
      {ranked.map((u, i) => (
        <li
          key={u.username}
          ref={(el) => {
            if (el) rowRefs.current.set(u.username, el);
            else rowRefs.current.delete(u.username);
          }}
          className="flex items-center justify-between rounded-xl border border-line bg-pitch-night-raised p-3 shadow-sm"
        >
          <div>
            <div className="font-medium text-text-primary">
              <span className="mr-1 text-text-muted">{i + 1}.</span>
              {u.username}
            </div>
            <div className="text-xs text-text-muted">
              {u.total} kupon, %{u.winRate} kazanma · bakiye {u.staBalance} STA
            </div>
          </div>
          <div className={`font-bold ${u.score.net > 0 ? 'text-green-400' : u.score.net < 0 ? 'text-red-400' : 'text-text-muted'}`}>
            {u.score.net > 0 ? '+' : ''}{u.score.net} puan
          </div>
        </li>
      ))}
      {ranked.length === 0 && (
        <li className="rounded-xl border border-line bg-pitch-night-raised p-4 text-center text-sm text-text-muted shadow-sm">
          Henüz kullanıcı yok.
        </li>
      )}
    </ol>
  );
}
