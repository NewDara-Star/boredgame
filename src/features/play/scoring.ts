export const ROUND_MS = 45_000;

/**
 * Speed matters but knowing matters more: a correct answer is never worth less
 * than 500, so a slow solver still out-scores a fast guesser.
 */
export function scoreAnswer(msTaken: number, streak: number, hintsUsed: number): number {
  const speed = Math.max(0, 1 - msTaken / ROUND_MS);
  const base = 500 + Math.round(500 * speed);
  const hintPenalty = hintsUsed * 100;
  const streakBonus = Math.min(streak, 5) * 60;
  return Math.max(150, base - hintPenalty + streakBonus);
}
