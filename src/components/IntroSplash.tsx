'use client';

import { useEffect, useLayoutEffect, useState } from 'react';

// useLayoutEffect warns when used during SSR (Next.js server-renders 'use
// client' components too). Fall back to useEffect on the server; the
// component is only ever interactive in the browser anyway.
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export default function IntroSplash() {
  // Default to visible so the splash is present from the very first paint —
  // no frame where the home page is shown before the splash pops in.
  const [visible, setVisible] = useState(true);
  const [fadingOut, setFadingOut] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  useIsomorphicLayoutEffect(() => {
    setReduceMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    // Runs before the browser paints, so a same-session revisit hides the
    // splash before it's ever drawn — no flash in either direction.
    if (sessionStorage.getItem('ferraribet-intro-seen')) {
      setVisible(false);
    }
  }, []);

  function dismiss() {
    sessionStorage.setItem('ferraribet-intro-seen', '1');
    if (reduceMotion) {
      setVisible(false);
      return;
    }
    setFadingOut(true);
    setTimeout(() => setVisible(false), 300);
  }

  if (!visible) return null;

  return (
    <div
      onClick={dismiss}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') dismiss();
      }}
      className={`fixed inset-0 z-50 flex cursor-pointer flex-col items-center justify-center bg-pitch-night transition-opacity duration-300 ${fadingOut ? 'opacity-0' : 'opacity-100'}`}
    >
      <div className={`text-6xl ${reduceMotion ? '' : 'jackpot-pulse'}`}>🎰</div>
      <h1 className="mt-4 font-display text-4xl tracking-widest text-text-primary">
        FERRARI<span className="text-ferrari-red">BET</span>
      </h1>
      <p className={`mt-6 text-xs font-semibold uppercase tracking-[0.3em] text-gold ${reduceMotion ? '' : 'animate-pulse'}`}>
        Herhangi bir yere tıkla
      </p>
    </div>
  );
}
