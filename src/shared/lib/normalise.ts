/**
 * Answer comparison for the free-text games.
 *
 * `normalise` mirrors normalise_answer() in supabase/schema.sql exactly — if you
 * change one, change the other, or the client and the database will disagree
 * about what counts as correct.
 *
 * Everything BELOW normalise is deliberately client-only. Nothing server-side
 * ever judges a typed answer — rooms decide it here and the daily round is
 * multiple choice — so the generosity can live in one place without a twin in
 * SQL that would have to be kept in step.
 */
export function normalise(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * How many characters a guess may be out by, given how long the answer is.
 *
 * "reading between the lines" is twenty-two characters after normalising and a
 * single slip anywhere in it used to be simply wrong, which is infuriating when
 * you have plainly solved the puzzle. Short answers get nothing, because at
 * four characters a one-edit allowance starts accepting different words.
 *
 * This is only safe while no two answers in the bank sit within it of each
 * other. `check-rebus.mts` asserts exactly that, over every puzzle it can see.
 */
export function slack(normalisedAnswer: string): number {
  const n = normalisedAnswer.length;
  return n < 8 ? 0 : n < 14 ? 1 : 2;
}

/** Every spelling a puzzle will take: its answer, plus anything hand-listed. */
export const spellings = (answer: string, accept?: string[] | null) =>
  [answer, ...(accept ?? [])].map(normalise).filter(Boolean);

export function isCorrect(guess: string, answer: string, accept?: string[] | null): boolean {
  const g = normalise(guess);
  if (!g) return false;
  return spellings(answer, accept).some(
    (want) => g === want || levenshtein(g, want) <= slack(want));
}

/** How close a wrong guess was, 0..1 — used to say "so close" rather than "no". */
export function closeness(guess: string, answer: string, accept?: string[] | null): number {
  const a = normalise(guess);
  if (!a) return 0;
  return Math.max(0, ...spellings(answer, accept).map((b) =>
    Math.max(0, 1 - levenshtein(a, b) / Math.max(a.length, b.length))));
}

/**
 * Worth logging as a near miss: close enough that a person plausibly solved the
 * puzzle and said it differently. A guess nowhere near the answer teaches
 * nothing about the accept list and is most of the volume.
 */
export function nearMiss(guess: string, answer: string, accept?: string[] | null): boolean {
  const g = normalise(guess);
  return g.length >= 3 && !isCorrect(guess, answer, accept)
    && closeness(guess, answer, accept) >= 0.5;
}

export function levenshtein(a: string, b: string): number {
  // Cheap reject: an edit distance can never be smaller than the length gap,
  // and most comparisons here are against an answer of a very different size.
  if (Math.abs(a.length - b.length) > Math.max(a.length, b.length)) return Infinity;
  const prev = new Array(b.length + 1).fill(0).map((_, i) => i);
  const cur = new Array(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    for (let j = 0; j <= b.length; j++) prev[j] = cur[j];
  }
  return prev[b.length];
}
