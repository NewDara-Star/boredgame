/**
 * The logo, drawn rather than typed. It used to be two spans of Fredoka, which
 * is a typeface choice, not a logotype — and it could not go on the share card,
 * the favicon, or anything that is not the DOM.
 *
 * `textLength` pins the width so the mark is the same shape before and after
 * the webfont loads, which is the same trick the rebus renderer uses.
 */
export function Wordmark({
  height = 30, fill = "#FFFFFF", className = "",
}: { height?: number; fill?: string; className?: string }) {
  const W = 300, H = 76;
  const shared = {
    fontFamily: "Fredoka, system-ui, sans-serif",
    fontWeight: 600,
    fontSize: 54,
    textLength: 268,
    lengthAdjust: "spacingAndGlyphs" as const,
    x: 14,
  };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} height={height} width={(W / H) * height}
      role="img" aria-label="BoredGame" className={className} overflow="visible">
      {/* the hard offset shadow, then the outlined mark on top of it */}
      <text {...shared} y="58" fill="var(--color-ink)"
        stroke="var(--color-ink)" strokeWidth={13} strokeLinejoin="round" paintOrder="stroke">
        BoredGame
      </text>
      <text {...shared} y="51" fill={fill}
        stroke="var(--color-ink)" strokeWidth={13} strokeLinejoin="round" paintOrder="stroke">
        BoredGame
      </text>
    </svg>
  );
}

/** The four-point star with an orbit, straight off the reference boards. */
export function Starburst({
  size = 40, fill = "var(--color-pop)", className = "",
}: { size?: number; fill?: string; className?: string }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden className={className}>
      <ellipse cx="50" cy="62" rx="34" ry="12" fill="none" stroke={fill} strokeWidth="5"
        transform="rotate(-18 50 62)" />
      <path d="M50 6 L60 42 L96 50 L60 58 L50 96 L40 58 L4 50 L40 42 Z" fill={fill} />
    </svg>
  );
}
