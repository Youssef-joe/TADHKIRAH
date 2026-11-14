'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Fades content up into view the first time it enters the viewport.
 * Respects prefers-reduced-motion (content then appears immediately), and the
 * content stays visible if JavaScript is off.
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
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight) return; // already on screen
    setState('hidden');
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
      style={{
        transition: 'opacity 700ms ease, transform 700ms ease',
        transitionDelay: `${delay}ms`,
        opacity: state === 'hidden' ? 0 : 1,
        transform: state === 'hidden' ? 'translateY(16px)' : 'none',
      }}
    >
      {children}
    </div>
  );
}
