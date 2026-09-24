import { Art } from "@/shared/brand/Art";
import { RAMPS } from "@/shared/brand/tokens";

/**
 * The eight faces, drawn in the brand's chunky style instead of emoji (which look
 * different on every phone). Index order is the deck's: a stored deck of indices
 * still deals the same pairs.
 */
export const FACE_NAMES = ["sunflower", "flame", "house", "star", "heart", "raindrop", "leaf", "moon"];

const OUT = "var(--color-ink-day)";
const drawn: Record<number, (id: string) => JSX.Element> = {
  3: () => <path d="M24 6 L29.6 18 L42.6 19.3 L32.8 28 L35.6 41 L24 34.4 L12.4 41 L15.2 28 L5.4 19.3 L18.4 18 Z" fill={RAMPS.petal.base} stroke={OUT} strokeWidth="3.4" strokeLinejoin="round" />,
  4: () => <path d="M24 41 C9 31 5 23 5 16.5 C5 10.5 9.8 6.5 15 6.5 C19 6.5 22 9 24 12 C26 9 29 6.5 33 6.5 C38.2 6.5 43 10.5 43 16.5 C43 23 39 31 24 41 Z" fill={RAMPS.gum.base} stroke={OUT} strokeWidth="3.4" strokeLinejoin="round" />,
  5: () => <path d="M24 5 C31 15 37 22 37 29.5 C37 36.7 31.2 42 24 42 C16.8 42 11 36.7 11 29.5 C11 22 17 15 24 5 Z" fill={RAMPS.sky.base} stroke={OUT} strokeWidth="3.4" strokeLinejoin="round" />,
  6: () => <><path d="M9 39 C9 20 22 8 40 8 C40 27 29 39 9 39 Z" fill={RAMPS.leaf.base} stroke={OUT} strokeWidth="3.4" strokeLinejoin="round" /><path d="M11 37 L32 16" stroke={OUT} strokeWidth="2.6" strokeLinecap="round" /></>,
  7: () => <path d="M30 6 C19 7.5 11 16 11 26.5 C11 35.6 18.4 43 27.5 43 C33.5 43 38.6 40 41.5 35.2 C39.6 35.9 37.6 36.3 35.4 36.3 C26.3 36.3 19 29 19 19.9 C19 13.8 23.4 8.6 30 6 Z" fill={RAMPS.grape.base} stroke={OUT} strokeWidth="3.4" strokeLinejoin="round" />,
};
const ART: Record<number, string> = { 0: "sfh-awake", 1: "streak", 2: "nav-home" };

export function MemoryFace({ face }: { face: number }) {
  if (ART[face]) return <Art name={ART[face]} style={{ width: "62%" }} />;
  const d = drawn[face];
  return (
    <svg viewBox="0 0 48 48" width="60%" aria-hidden className="overflow-visible">
      {d?.("f")}
      <ellipse cx="17" cy="15" rx="3.2" ry="1.9" transform="rotate(-35 17 15)" fill="white" opacity=".8" />
    </svg>
  );
}
