/**
 * What a room is allowed to deal from.
 *
 * A room could always narrow by category. It could not narrow by difficulty,
 * so every room drew from the whole bank — and with 360 of 1,787 trivia
 * questions marked hard, roughly one question in five was hard for whoever was
 * sitting there, including a nine-year-old.
 *
 * Kept free of imports so `scripts/check-scope.mts` can load it under bare Node.
 */

export type Level = "easy" | "medium" | "hard";

export const LEVELS: Level[] = ["easy", "medium", "hard"];

/** The subset of a puzzle this module needs. Anything with these two fields. */
export interface Scopeable {
  category: string;
  difficulty: string;
}

/** Null and empty both mean "no restriction" — the database stores null, the
    lobby hands over an empty array, and neither should mean "nothing". */
export interface Scope {
  categories?: string[] | null;
  difficulty?: string[] | null;
}

export function scopePool<T extends Scopeable>(pool: T[], scope: Scope): T[] {
  const cats = scope.categories?.length ? new Set(scope.categories) : null;
  const levels = scope.difficulty?.length ? new Set(scope.difficulty) : null;
  if (!cats && !levels) return pool;
  return pool.filter((i) =>
    (!cats || cats.has(i.category)) && (!levels || levels.has(i.difficulty)));
}

/**
 * Why the pool came out empty. Three call sites each grew their own version of
 * this sentence, and the interesting case — a category and a difficulty that
 * are each fine alone and have nothing in common — none of them covered.
 */
export function emptyReason(scope: Scope, bankIsEmpty: boolean): string {
  if (bankIsEmpty) return "No questions are live for this game yet.";
  const cats = scope.categories?.length ? scope.categories.join(" or ") : null;
  const levels = scope.difficulty?.length ? scope.difficulty.join(" or ") : null;
  if (cats && levels) return `Nothing ${levels} in ${cats}. Widen either one and try again.`;
  if (cats) return `Nothing live in ${cats}. Widen the categories and try again.`;
  if (levels) return `Nothing ${levels} for this game. Widen the difficulty and try again.`;
  return "No questions are live for this game yet.";
}

/** How many of each level survive the category filter, for the lobby's counts. */
export function levelCounts<T extends Scopeable>(
  pool: T[], categories?: string[] | null,
): Record<Level, number> {
  const scoped = scopePool(pool, { categories });
  const out: Record<Level, number> = { easy: 0, medium: 0, hard: 0 };
  for (const i of scoped) if (i.difficulty in out) out[i.difficulty as Level] += 1;
  return out;
}
