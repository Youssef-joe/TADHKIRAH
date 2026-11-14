'use client';

import { useEffect, useRef, useState } from 'react';
import { arcPoint, PALETTES, type SkyState } from '@/lib/sky';

/** Smoothly animates a number toward `target` (rAF tween, eased). Jumps when motion is reduced. */
function useTween(target: number, duration = 2400): number {
  const [value, setValue] = useState(target);
  const from = useRef(target);
  const current = useRef(target);
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      current.current = target;
      setValue(target);
      return;
    }
    from.current = current.current;
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / duration);
      const eased = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      current.current = from.current + (target - from.current) * eased;
      setValue(current.current);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

/** Deterministic star field (same on server and client, so no hydration mismatch). */
const STARS = Array.from({ length: 34 }, (_, i) => {
  const r = (n: number) => (((Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1) + 1) % 1;
  return { x: 20 + r(1) * 440, y: 30 + r(2) * 260, size: 0.6 + r(3) * 1.4, delay: r(4) * 5 };
});

const T = 'transition-[stop-color,fill,opacity] duration-[2400ms] ease-in-out';

/**
 * The living sky: gradient, sun/moon on an arc, stars, a mosque skyline with
 * windows that glow after dark, birds by day, and gentle parallax. Everything
 * is SVG and CSS, and it uses `id` prefixes so several scenes can share a page.
 */
export function SkyScene({
  state,
  id,
  framed = false,
  parallax = false,
  className,
}: {
  state: SkyState;
  id: string;
  framed?: boolean;
  parallax?: boolean;
  className?: string;
}) {
  const p = PALETTES[state.phase];
  const sunP = useTween(state.sun);
  const moonP = useTween(state.moon);
  const sun = arcPoint(sunP);
  const moon = arcPoint(moonP);
  const sunVisible = sunP > -0.08 && sunP < 1.08;
  const moonVisible = state.phase === 'night' || state.phase === 'isha' || state.phase === 'fajr';
  const day = state.phase === 'day' || state.phase === 'sunrise' || state.phase === 'asr';
  const rootRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!parallax || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() =>
        rootRef.current?.style.setProperty('--scroll', String(Math.min(window.scrollY, 600))),
      );
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
    };
  }, [parallax]);

  const layer = (k: number) =>
    parallax ? { transform: `translateY(calc(var(--scroll, 0) * ${k}px))` } : undefined;
  const clip = framed ? `url(#${id}-frame)` : undefined;

  return (
    <svg
      ref={rootRef}
      aria-hidden
      viewBox="0 0 480 520"
      preserveAspectRatio={framed ? 'xMidYMid meet' : 'xMidYMax slice'}
      className={className}
    >
      <defs>
        <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" className={T} style={{ stopColor: p.top }} />
          <stop offset="0.5" className={T} style={{ stopColor: p.mid }} />
          <stop offset="0.76" className={T} style={{ stopColor: p.horizon }} />
        </linearGradient>
        <radialGradient id={`${id}-glow`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" className={T} style={{ stopColor: p.glow, stopOpacity: 0.9 }} />
          <stop offset="1" className={T} style={{ stopColor: p.glow, stopOpacity: 0 }} />
        </radialGradient>
        <radialGradient id={`${id}-sunglow`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" style={{ stopColor: p.sun, stopOpacity: 0.65 }} className={T} />
          <stop offset="1" style={{ stopColor: p.sun, stopOpacity: 0 }} className={T} />
        </radialGradient>
        <mask id={`${id}-crescent`}>
          <rect x="-40" y="-40" width="80" height="80" fill="black" />
          <circle r="20" fill="white" />
          <circle cx="9" cy="-6" r="18" fill="black" />
        </mask>
        {framed && (
          <clipPath id={`${id}-frame`}>
            <path d="M24 520V200a216 176 0 0 1 432 0v320z" />
          </clipPath>
        )}
      </defs>

      <g clipPath={clip}>
        <rect width="480" height="520" fill={`url(#${id}-sky)`} />
        <ellipse
          cx="240"
          cy="392"
          rx="300"
          ry="120"
          fill={`url(#${id}-glow)`}
          className="tk-glow"
        />

        {/* Stars and a shooting star */}
        <g className={T} style={{ opacity: p.stars }}>
          {STARS.map((s, i) => (
            <circle
              key={i}
              className="tk-twinkle"
              style={{ animationDelay: `${s.delay}s` }}
              cx={s.x}
              cy={s.y}
              r={s.size}
              fill="#fdf6e3"
            />
          ))}
          <line
            className="tk-shoot"
            x1="0"
            y1="0"
            x2="46"
            y2="16"
            stroke="#fdf6e3"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </g>

        {/* Sun */}
        {sunVisible && (
          <g transform={`translate(${sun.x} ${sun.y})`}>
            <circle r="70" fill={`url(#${id}-sunglow)`} />
            <circle r="22" className={T} style={{ fill: p.sun }} />
          </g>
        )}
        {/* Moon */}
        <g
          transform={`translate(${moon.x} ${moon.y})`}
          className="transition-opacity duration-[2400ms]"
          style={{ opacity: moonVisible ? 1 : 0 }}
        >
          <circle r="46" fill="#f6dfa4" opacity="0.12" />
          <rect
            x="-40"
            y="-40"
            width="80"
            height="80"
            fill="#f6dfa4"
            mask={`url(#${id}-crescent)`}
          />
        </g>

        {/* Birds by day */}
        {day && (
          <g
            className="tk-birds"
            fill="none"
            stroke={p.main}
            strokeWidth="1.6"
            strokeLinecap="round"
          >
            <path d="M0 140q6-6 12 0q6-6 12 0" />
            <path d="M22 128q5-5 10 0q5-5 10 0" />
            <path d="M-14 124q4-4 8 0q4-4 8 0" />
          </g>
        )}

        {/* Distant skyline */}
        <g style={layer(-0.04)} className={T} fill={p.back}>
          <path
            d="M0 520V392h30v-22a14 14 0 0 1 28 0v22h40v-34h8v-14h6v14h8v34h46v-18a22 20 0 0 1 44 0v18h70v-40h10v40h60v-26a18 16 0 0 1 36 0v26h40v-30h6v-10h4v10h6v30h38v128z"
            style={{ fill: p.back }}
            className={T}
          />
        </g>

        {/* The mosque */}
        <g style={layer(-0.02)}>
          <g className={T} style={{ fill: p.main }}>
            {/* minarets */}
            <path d="M86 410V246h20v164z" />
            <path d="M82 246h28l-14-34z" />
            <rect x="80" y="292" width="32" height="7" rx="2" />
            <rect x="94" y="196" width="4" height="18" />
            <path d="M374 410V246h20v164z" />
            <path d="M370 246h28l-14-34z" />
            <rect x="368" y="292" width="32" height="7" rx="2" />
            <rect x="382" y="196" width="4" height="18" />
            {/* side domes */}
            <path d="M118 360a34 30 0 0 1 68 0z" />
            <path d="M294 360a34 30 0 0 1 68 0z" />
            {/* main dome, drum and finial */}
            <rect x="170" y="318" width="140" height="18" />
            <path d="M176 320a64 70 0 0 1 128 0z" />
            <rect x="238" y="232" width="4" height="22" />
            <circle cx="240" cy="230" r="4" />
            {/* hall */}
            <rect x="112" y="356" width="256" height="64" />
          </g>
          {/* arched windows: glow after dark */}
          <g className={T} style={{ opacity: 0.25 + p.windows * 0.75 }}>
            {[132, 172, 212, 252, 292, 332].map((x) => (
              <path
                key={x}
                d={`M${x} 412v-26a8 9 0 0 1 16 0v26z`}
                className={T}
                style={{ fill: p.windows > 0.3 ? '#f6c76b' : p.horizon }}
              />
            ))}
          </g>
        </g>

        {/* Foreground: wall and palms */}
        <g className={T} style={{ fill: p.front, stroke: p.front }}>
          <path d="M0 520V414h480v106z" strokeWidth="0" />
          {Array.from({ length: 24 }, (_, i) => (
            <rect key={i} x={i * 20 + 4} y="406" width="12" height="10" strokeWidth="0" />
          ))}
          <g fill="none" strokeWidth="5" strokeLinecap="round">
            <path d="M40 416q-6-60 4-104" strokeWidth="7" />
            <path d="M44 312q-30-4-46 14M44 312q-22-20-44-16M44 312q10-26 34-30M44 312q26-6 44 10M44 312q4 22-6 40" />
            <path d="M444 416q6-58-6-100" strokeWidth="7" />
            <path d="M438 316q30-6 46 10M438 316q22-22 44-18M438 316q-10-26-34-30M438 316q-26-4-44 12M438 316q-4 22 6 40" />
          </g>
        </g>

        {/* Reflecting pool: mirrors the sky colour, with slow ripples */}
        <g>
          <rect
            x="70"
            y="440"
            width="340"
            height="44"
            rx="4"
            className={T}
            style={{ fill: p.horizon, opacity: 0.55 }}
          />
          <rect
            x="70"
            y="440"
            width="340"
            height="20"
            rx="4"
            className={T}
            style={{ fill: p.mid, opacity: 0.45 }}
          />
          <g className={T} style={{ fill: '#f6c76b', opacity: p.windows * 0.5 }}>
            {[132, 172, 212, 252, 292, 332].map((x) => (
              <rect key={x} x={x + 2} y="448" width="12" height="3" rx="1.5" />
            ))}
          </g>
          <g fill="none" stroke="#ffffff" strokeWidth="1" strokeLinecap="round" opacity="0.35">
            <path className="tk-ripple" d="M110 466h60M210 472h80M320 464h50" />
            <path
              className="tk-ripple"
              style={{ animationDelay: '2s' }}
              d="M150 476h40M250 460h50M340 476h40"
            />
          </g>
        </g>
      </g>

      {framed && (
        <>
          <path
            d="M24 520V200a216 176 0 0 1 432 0v320"
            fill="none"
            stroke="#b08d3c"
            strokeWidth="2.2"
            opacity="0.85"
          />
          <path
            d="M38 520V202a202 162 0 0 1 404 0v318"
            fill="none"
            stroke="#b08d3c"
            strokeWidth="0.8"
            opacity="0.5"
          />
        </>
      )}
    </svg>
  );
}
