'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';

// useLayoutEffect warns when used during SSR (Next.js server-renders 'use
// client' components too). Fall back to useEffect on the server; the
// component is only ever interactive in the browser anyway. Also sidesteps
// react-hooks/set-state-in-effect, which only flags setState called
// synchronously in a plain useEffect body — see IntroSplash.tsx for the
// same pattern.
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export default function Reveal({
  children,
  delayMs = 0,
  className = '',
}: {
  children: React.ReactNode;
  delayMs?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [skipAnimation, setSkipAnimation] = useState(false);

  useIsomorphicLayoutEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setSkipAnimation(true);
      setVisible(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  if (skipAnimation) return <div className={className}>{children}</div>;

  return (
    <div
      ref={ref}
      className={`${className} transition-all duration-500 ease-out ${visible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}
      style={{ transitionDelay: visible ? `${delayMs}ms` : '0ms' }}
    >
      {children}
    </div>
  );
}
