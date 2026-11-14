/**
 * Small line-art vignettes for the feature cards. Their strokes "draw"
 * themselves when the card scrolls into view (.tk-draw inside a shown
 * <Reveal>). They use currentColor, so they follow the theme.
 */
const common = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  pathLength: 1,
  className: 'tk-draw',
};

export function FeatureArt({ kind }: { kind: 'reflection' | 'worship' | 'quran' | 'sunnah' }) {
  return (
    <svg aria-hidden viewBox="0 0 160 100" className="h-24 w-full text-primary">
      {kind === 'reflection' && (
        <>
          <path {...common} d="M30 20h44a6 6 0 0 1 6 6v58a6 6 0 0 0-6-6H30z" />
          <path {...common} d="M130 20H86a6 6 0 0 0-6 6v58a6 6 0 0 1 6-6h44z" />
          <path {...common} style={{ animationDelay: '0.5s' }} d="M90 36h30M90 48h26M90 60h20" />
          <path
            {...common}
            style={{ animationDelay: '0.9s' }}
            d="M40 38c6-6 12 6 18 0s12 6 18 0"
            className="tk-draw text-accent"
          />
        </>
      )}
      {kind === 'worship' && (
        <>
          <path {...common} d="M50 90V40a30 30 0 0 1 60 0v50z" />
          <path {...common} style={{ animationDelay: '0.4s' }} d="M64 90V56a16 16 0 0 1 32 0v34" />
          <path {...common} style={{ animationDelay: '0.8s' }} d="M30 90h100" />
          <path
            {...common}
            style={{ animationDelay: '1.1s' }}
            d="M120 28l6 6 12-14"
            className="tk-draw text-accent"
          />
        </>
      )}
      {kind === 'quran' && (
        <>
          <path
            {...common}
            d="M80 30c-14-10-34-10-48-4v56c14-6 34-6 48 4 14-10 34-10 48-4V26c-14-6-34-6-48 4z"
          />
          <path {...common} style={{ animationDelay: '0.5s' }} d="M80 30v56" />
          <path
            {...common}
            style={{ animationDelay: '0.8s' }}
            d="M42 42h26M42 54h22M92 42h26M96 54h22"
          />
          <path
            {...common}
            style={{ animationDelay: '1.2s' }}
            d="M60 92l20-8 20 8"
            className="tk-draw text-accent"
          />
        </>
      )}
      {kind === 'sunnah' && (
        <>
          <g className="tk-spin-slow" style={{ transformOrigin: '80px 50px' }}>
            <rect {...common} x="56" y="26" width="48" height="48" />
            <rect
              {...common}
              style={{ animationDelay: '0.3s' }}
              x="56"
              y="26"
              width="48"
              height="48"
              transform="rotate(45 80 50)"
            />
          </g>
          <circle
            {...common}
            style={{ animationDelay: '0.7s' }}
            cx="80"
            cy="50"
            r="10"
            className="tk-draw text-accent"
          />
          <path {...common} style={{ animationDelay: '1s' }} d="M20 50h22M118 50h22" />
        </>
      )}
    </svg>
  );
}
