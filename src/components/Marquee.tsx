'use client';

import { useEffect, useState } from 'react';

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

  useEffect(() => {
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
