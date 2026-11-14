'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Fades content up into view the first time it enters the viewport, and sets
 * `data-shown` so child animations (line drawing, timeline fill) start then.
 * Respects prefers-reduced-motion, and content stays visible without JavaScript.
 */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<'idle' | 'hidden' | 'shown'>('idle');

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return setState('shown');
    const onScreen = el.getBoundingClientRect().top < window.innerHeight * 0.9;
    if (!onScreen) setState('hidden');
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setState('shown');
          io.disconnect();
        }
      },
      { rootMargin: '0px 0px -10% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      data-shown={state === 'shown' ? '' : undefined}
      style={{
        transition: 'opacity 800ms ease, transform 800ms cubic-bezier(.2,.7,.2,1)',
        transitionDelay: `${delay}ms`,
        opacity: state === 'hidden' ? 0 : 1,
        transform: state === 'hidden' ? 'translateY(24px)' : 'none',
      }}
    >
      {children}
    </div>
  );
}
