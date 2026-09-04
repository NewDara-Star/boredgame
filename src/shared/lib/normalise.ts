/**
 * Answer comparison. Mirrors normalise_answer() in supabase/schema.sql exactly —
 * if you change one, change the other, or the client and the database will
 * disagree about what counts as correct.
 */
export function normalise(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function isCorrect(guess: string, answer: string): boolean {
  const g = normalise(guess);
  return g.length > 0 && g === normalise(answer);
}

/** How close a wrong guess was, 0..1 — used to say "so close" rather than just "no". */
export function closeness(guess: string, answer: string): number {
  const a = normalise(guess);
  const b = normalise(answer);
  if (!a || !b) return 0;
  const d = levenshtein(a, b);
  return Math.max(0, 1 - d / Math.max(a.length, b.length));
}

function levenshtein(a: string, b: string): number {
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
