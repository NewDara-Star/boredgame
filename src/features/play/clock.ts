/**
 * How long a question is given.
 *
 * It was a flat 15 seconds for everything, which is generous for "What colour
 * is the sky" and mean for a four-line question with four long options — and
 * the same fifteen seconds for a nine-year-old reading it out loud as for
 * someone who has played a hundred rounds.
 *
 * Derived from the QUESTION rather than set per room, so both clients compute
 * the same deadline from the same puzzle without another column to keep in
 * step. stallWriter's grace period is layered on top of whatever this returns,
 * so a slow answer is still never mistaken for someone leaving.
 *
 * Import-free so scripts/check-clock.mts can load it under bare Node.
 */
export const ASK_MS = 15_000;

const BY_LEVEL: Record<string, number> = {
  easy: 15_000,
  medium: 18_000,
  hard: 22_000,
};

/** Falls back to the base while the question is still loading, so the bar never
    starts from a number it is about to change. */
export function askMs(difficulty?: string | null): number {
  return BY_LEVEL[difficulty ?? ""] ?? ASK_MS;
}
