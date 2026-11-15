'use client';

import { useEffect, useState } from 'react';
import { Icon, type IconName } from '../ui/icons';

export type Fmt = (n: number) => string;

/** Counts up from 0 once on mount (instant under reduced motion). */
function CountUp({ value, fmt }: { value: number; fmt: Fmt }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return setShown(value);
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / 900);
      setShown(value * (1 - Math.pow(1 - k, 3)));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{fmt(Number.isInteger(value) ? Math.round(shown) : Math.round(shown * 10) / 10)}</>;
}

export function Tile({
  icon,
  label,
  value,
  fmt,
  tone,
}: {
  icon: IconName;
  label: string;
  value: number;
  fmt: Fmt;
  tone: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-border bg-surface p-4">
      <Icon name={icon} className={tone} />
      <p className="text-3xl font-semibold tabular-nums">
        <CountUp value={value} fmt={fmt} />
      </p>
      <p className="text-sm text-muted">{label}</p>
    </div>
  );
}
