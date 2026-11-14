/** A hanging fanous (lantern) that sways gently and glows. Decorative only. */
export function Lantern({
  className,
  delay = 0,
  chain = 60,
}: {
  className?: string;
  delay?: number;
  chain?: number;
}) {
  return (
    <svg
      aria-hidden
      viewBox={`0 0 60 ${chain + 110}`}
      className={`tk-sway ${className ?? ''}`}
      style={{ animationDelay: `${delay}s` }}
    >
      <defs>
        <radialGradient id={`lantern-glow-${chain}-${delay}`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffd88a" stopOpacity="0.9" />
          <stop offset="1" stopColor="#ffd88a" stopOpacity="0" />
        </radialGradient>
      </defs>
      <line x1="30" y1="0" x2="30" y2={chain} stroke="#b08d3c" strokeWidth="1.5" />
      <g transform={`translate(0 ${chain})`}>
        <circle
          className="tk-glow"
          cx="30"
          cy="52"
          r="34"
          fill={`url(#lantern-glow-${chain}-${delay})`}
        />
        <path d="M22 6h16l6 12H16z" fill="#b08d3c" />
        <circle cx="30" cy="3" r="3" fill="none" stroke="#b08d3c" strokeWidth="1.5" />
        <path d="M14 18h32l-4 52H18z" fill="#0b2a24" stroke="#b08d3c" strokeWidth="1.5" />
        <path d="M20 24h20l-3 40H23z" fill="#ffd88a" opacity="0.85" />
        <path d="M30 24v40M21.5 44h17" stroke="#b08d3c" strokeWidth="1" />
        <path d="M18 70h24l-6 12H24z" fill="#b08d3c" />
        <path d="M30 82v14" stroke="#b08d3c" strokeWidth="1.5" />
        <circle cx="30" cy="99" r="3" fill="#b08d3c" />
      </g>
    </svg>
  );
}
