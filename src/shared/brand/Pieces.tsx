/**
 * The pieces BoredGame's games are made of, drawn instead of typed (BRAND.md,
 * "Pieces and icons"). Typed ✕ ◯ ● ◆ ✓ ✗ render differently on every phone and // brand-ok: names the glyphs this file replaces
 * can't carry the outline, so these replace them everywhere.
 *
 *   PieceMark  a seat's mark in a score chip: cross, ring, disc or tile, in the
 *              seat's colour with the ink outline subjects carry
 *   AnswerMark an answer option's marker: a bubblegum disc, sky ring, petal
 *              cross or leaf tile, outlined like every piece (drawing #16),
 *              becoming an ink tick (right) or cross (wrong) on reveal
 */
export type PieceKind = "cross" | "ring" | "disc" | "tile";

const PATHS: Record<PieceKind, (fill: string) => JSX.Element> = {
  disc: (f) => <circle cx="12" cy="12" r="8" fill={f} />,
  ring: (f) => <circle cx="12" cy="12" r="6.5" fill="none" stroke={f} strokeWidth="4" />,
  cross: (f) => <path d="M6.5 6.5 L17.5 17.5 M17.5 6.5 L6.5 17.5" stroke={f} strokeWidth="4.2" strokeLinecap="round" />,
  tile: (f) => <rect x="5" y="4" width="14" height="16" rx="3" fill={f} />,
};
const OUTLINE: Record<PieceKind, JSX.Element> = {
  disc: <circle cx="12" cy="12" r="9.4" fill="var(--color-ink-day)" />,
  ring: <circle cx="12" cy="12" r="6.5" fill="none" stroke="var(--color-ink-day)" strokeWidth="7" />,
  cross: <path d="M6.5 6.5 L17.5 17.5 M17.5 6.5 L6.5 17.5" stroke="var(--color-ink-day)" strokeWidth="7.4" strokeLinecap="round" />,
  tile: <rect x="3.6" y="2.6" width="16.8" height="18.8" rx="4" fill="var(--color-ink-day)" />,
};

export function PieceMark({ kind, colour, size = 20, outlined = true }:
  { kind: PieceKind; colour: string; size?: number; outlined?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden className="shrink-0 overflow-visible">
      {outlined && OUTLINE[kind]}
      {PATHS[kind](colour)}
    </svg>
  );
}

export function Tick({ size = 18 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden className="shrink-0">
      <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
export function XMark({ size = 18 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden className="shrink-0">
      <path d="M7 7l10 10M17 7L7 17" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" />
    </svg>
  );
}

/** Four answers, four pieces, four colours (drawing #16): a shape tells them
    apart without the colour, the colour without the shape. They used to be
    plain ink until a pick. */
const ORDER: PieceKind[] = ["disc", "ring", "cross", "tile"];
const TINT = ["var(--color-gum)", "var(--color-sky)", "var(--color-petal)", "var(--color-leaf)"];
export function AnswerMark({ index, state = "idle", size = 18 }:
  { index: number; state?: "idle" | "right" | "wrong"; size?: number }) {
  if (state === "right") return <Tick size={size} />;
  if (state === "wrong") return <XMark size={size} />;
  return <PieceMark kind={ORDER[index % 4]} colour={TINT[index % 4]} size={size} />;
}
