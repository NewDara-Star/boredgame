import { onColour, RAMPS, type Hue } from "@/shared/brand/tokens";

/** Players are discs (the Connect 4 counter) in their colour with their first letter
    (BRAND.md, "The sunflower"). Discs are subjects, so they carry the ink outline. */
const HUES: Hue[] = ["petal", "sky", "leaf", "ember", "grape", "gum"];

/** Same id, same colour, forever — including across devices, so it reads as identity. */
function hue(seed: string): Hue {
  let h = 0;
  if (!seed) return HUES[0];
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return HUES[h % HUES.length];
}

export function Avatar({
  id, name, size = 44, className = "",
}: { id?: string | null; name?: string | null; size?: number; className?: string }) {
  const h = hue(id ?? "");
  const r = RAMPS[h];
  return (
    <span
      className={`grid place-items-center shrink-0 font-display ${className}`}
      style={{
        width: size, height: size, borderRadius: 999,
        background: `radial-gradient(circle at 35% 30%, ${r.hi}, ${r.base} 55%, ${r.lo})`,
        color: onColour(h), fontSize: size * 0.44, lineHeight: 1,
        border: `${Math.max(2, size * 0.06)}px solid var(--color-ink-day)`,
        boxShadow: `0 ${Math.max(2, size * 0.06)}px 0 var(--color-ink-day)`,
      }}
      aria-hidden>
      {(name?.trim()?.[0] ?? "?").toUpperCase()}
    </span>
  );
}
