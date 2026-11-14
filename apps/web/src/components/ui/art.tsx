/**
 * Decorative artwork, hand-drawn in SVG: no stock images, no third-party
 * requests, and it uses the theme tokens so it works in light and dark.
 * Every piece is aria-hidden. Motion stays gentle and stops under
 * prefers-reduced-motion (globals.css).
 */

/** Repeating eight-fold star lattice, the classic khatam pattern. */
export function GeometricPattern({
  id = 'khatam',
  className,
  opacity = 0.08,
}: {
  id?: string;
  className?: string;
  opacity?: number;
}) {
  return (
    <svg aria-hidden className={className} width="100%" height="100%">
      <defs>
        <pattern id={id} width="56" height="56" patternUnits="userSpaceOnUse">
          <g fill="none" stroke="currentColor" strokeWidth="1">
            <rect x="16" y="16" width="24" height="24" />
            <rect x="16" y="16" width="24" height="24" transform="rotate(45 28 28)" />
            <circle cx="28" cy="28" r="5" />
            <path d="M0 0l16 16M56 0 40 16M0 56l16-16M56 56 40 40" />
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} opacity={opacity} />
    </svg>
  );
}

/** Hero scene: dawn sky, crescent, stars and a row of arches. */
export function DawnScene({ className }: { className?: string }) {
  const stars = [
    [60, 70, 1.6, 0],
    [130, 40, 1.1, 1.2],
    [210, 95, 1.4, 2.1],
    [300, 55, 1, 0.6],
    [370, 120, 1.3, 1.8],
    [90, 150, 0.9, 2.6],
    [255, 30, 1.2, 3.1],
    [340, 180, 0.8, 0.9],
  ] as const;
  return (
    <svg aria-hidden viewBox="0 0 420 420" className={className}>
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0b2a24" />
          <stop offset="0.38" stopColor="#0f5d4a" />
          <stop offset="0.6" stopColor="#7d8a4a" />
          <stop offset="0.72" stopColor="#d9b56a" />
          <stop offset="0.8" stopColor="#f3e3bd" />
        </linearGradient>
        <radialGradient id="glow" cx="0.5" cy="1" r="0.6">
          <stop offset="0" stopColor="#f6dfa4" stopOpacity="0.9" />
          <stop offset="1" stopColor="#f6dfa4" stopOpacity="0" />
        </radialGradient>
        <mask id="crescent">
          <rect width="420" height="420" fill="black" />
          <circle cx="300" cy="105" r="30" fill="white" />
          <circle cx="314" cy="96" r="27" fill="black" />
        </mask>
        <clipPath id="frame">
          <path d="M20 420V170a190 150 0 0 1 380 0v250z" />
        </clipPath>
      </defs>

      <g clipPath="url(#frame)">
        <rect width="420" height="420" fill="url(#sky)" />
        <ellipse className="tk-glow" cx="210" cy="320" rx="240" ry="120" fill="url(#glow)" />
        {stars.map(([x, y, r, delay], i) => (
          <circle
            key={i}
            className="tk-twinkle"
            style={{ animationDelay: `${delay}s` }}
            cx={x}
            cy={y}
            r={r}
            fill="#fdf6e3"
          />
        ))}
        {/* Crescent */}
        <g className="tk-float">
          <rect width="420" height="420" fill="#f6dfa4" mask="url(#crescent)" />
        </g>
        {/* Arcade of arches */}
        <g fill="#0a231e">
          <path d="M0 420V330h420v90z" />
          {[0, 1, 2, 3, 4].map((i) => {
            const x = 22 + i * 78;
            return <path key={i} d={`M${x} 335v-40a39 34 0 0 1 78 0v40z`} fill="#0d2f28" />;
          })}
          {[0, 1, 2, 3, 4].map((i) => {
            const x = 36 + i * 78;
            return (
              <path
                key={`w${i}`}
                d={`M${x} 335v-32a25 22 0 0 1 50 0v32z`}
                fill="#f3e3bd"
                opacity="0.18"
              />
            );
          })}
          {/* Dome and minaret */}
          <path d="M150 300a60 55 0 0 1 120 0z" fill="#0d2f28" />
          <rect x="206" y="226" width="8" height="22" fill="#0d2f28" />
          <path d="M335 335V215h18v120z" fill="#0d2f28" />
          <path d="M331 215h26l-13-26z" fill="#0d2f28" />
        </g>
      </g>
      {/* Gold frame of the arch */}
      <path
        d="M20 420V170a190 150 0 0 1 380 0v250"
        fill="none"
        stroke="#b08d3c"
        strokeWidth="2"
        opacity="0.8"
      />
      <path
        d="M34 420V172a176 138 0 0 1 352 0v248"
        fill="none"
        stroke="#b08d3c"
        strokeWidth="0.8"
        opacity="0.5"
      />
    </svg>
  );
}

/** A small ornamental divider (star between two lines). */
export function Ornament({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 120 16" className={className} width="120" height="16">
      <path d="M0 8h46M74 8h46" stroke="currentColor" strokeWidth="1" opacity="0.5" />
      <path
        d="M60 1.5l1.9 2.6 3.2-.5-.5 3.2L67.2 8l-2.6 1.9.5 3.2-3.2-.5L60 14.5l-1.9-2.6-3.2.5.5-3.2L52.8 8l2.6-1.9-.5-3.2 3.2.5z"
        fill="currentColor"
      />
    </svg>
  );
}
