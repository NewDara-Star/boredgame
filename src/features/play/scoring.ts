export const ROUND_MS = 45_000;

/** A right answer's points, piece by piece, so the reveal can say what earned them. */
export interface ScoreParts {
  /** for being right: always 500 */
  right: number;
  /** up to 500, running out over 45 s */
  speed: number;
  /** 60 for each right answer in a row, this one included, up to 5 */
  streak: number;
  /** 100 off for each hint */
  hints: number;
  total: number;
}

/**
 * Speed matters but knowing matters more: a correct answer is never worth less
 * than 500, so a slow solver still out-scores a fast guesser.
 *
 * The clock isn't shown while you answer, on purpose (talk item 4, Daramola):
 * no pressure to rush, and the reveal says what the speed earned afterwards.
 *
 * `streak` counts this answer too: the daily's server (daily_tally) always did,
 * and the phone was one behind it, so a first right answer got +0 here and +60
 * on the daily.
 */
export function scoreParts(msTaken: number, streak: number, hintsUsed: number): ScoreParts {
  const speed = Math.round(500 * Math.max(0, 1 - msTaken / ROUND_MS));
  const bonus = Math.min(streak, 5) * 60;
  const hints = hintsUsed * 100;
  return { right: 500, speed, streak: bonus, hints, total: Math.max(150, 500 + speed + bonus - hints) };
}

/** The daily's points come whole from the server; with its streak (this answer
    included) and no hints there, the pieces follow. */
export function partsOf(gained: number, streak: number): ScoreParts {
  const bonus = Math.min(streak, 5) * 60;
  return { right: 500, speed: Math.max(0, gained - 500 - bonus), streak: bonus, hints: 0, total: gained };
}

/** "500 right · +260 speed · +60 streak · −100 hint", leaving out what's 0. */
export function sayParts(p: ScoreParts): string {
  const bits = [`${p.right} right`];
  if (p.speed > 0) bits.push(`+${p.speed} speed`);
  if (p.streak > 0) bits.push(`+${p.streak} streak`);
  if (p.hints > 0) bits.push(`−${p.hints} hint${p.hints > 100 ? "s" : ""}`);
  return bits.join(" · ");
}
