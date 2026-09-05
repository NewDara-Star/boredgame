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

/**
 * The deadline for a phase that has NO rule about how long you may take.
 *
 * Two different things were being spelled with the same number. `askMs` is a
 * game rule — the bar is on screen, running out is a move you lost, and the
 * length is tuned to how long the question takes to read. This is not a rule
 * at all: it is the point past which a silent client is assumed to be gone, so
 * the other player can write the transition and carry on. Nothing counts down
 * to it and nothing is drawn for it.
 *
 * Lining up a catapult shot was given 30 seconds, which is a reading-a-question
 * number. A child aiming carefully can spend that, and did so with nothing on
 * screen to warn them — the mode that exists to remove time pressure had the
 * strictest hidden clock in the app. Ninety seconds is not a pace anyone plays
 * at; it only ever means the phone is face down.
 */
export const AWAY_MS = 90_000;
