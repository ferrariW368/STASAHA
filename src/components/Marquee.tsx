'use client';

import { useLayoutEffect, useEffect, useState } from 'react';

// useLayoutEffect warns when used during SSR (Next.js server-renders 'use
// client' components too). Fall back to useEffect on the server; the
// component is only ever interactive in the browser anyway. Also sidesteps
// react-hooks/set-state-in-effect, which only flags setState called
// synchronously in a plain useEffect body — see IntroSplash.tsx for the
// same pattern.
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export default function Marquee({
  items,
  durationSec = 22,
  className = '',
}: {
  items: React.ReactNode[];
  durationSec?: number;
  className?: string;
}) {
  const [reduceMotion, setReduceMotion] = useState(false);

  useIsomorphicLayoutEffect(() => {
    setReduceMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }, []);

  const group = (
    <div className="flex shrink-0 items-center gap-8 pr-8" aria-hidden={undefined}>
      {items.map((item, i) => (
        <span key={i} className="whitespace-nowrap">
          {item}
        </span>
      ))}
    </div>
  );

  return (
    <div className={`overflow-hidden ${className}`}>
      <div
        className={reduceMotion ? 'flex flex-wrap' : 'marquee-track flex'}
        style={reduceMotion ? undefined : { animationDuration: `${durationSec}s` }}
      >
        {group}
        {!reduceMotion && group}
      </div>
    </div>
  );
}
