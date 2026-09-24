/**
 * Stuck on a picture (talk item 5, Daramola): the first time, it goes to the
 * back of the round; when it comes back, or when nothing is left behind it,
 * "Show me" gives the answer and counts as a miss. Before this the only way
 * on was to type something wrong.
 *
 * Import-free, so scripts can load it under bare Node.
 */

/** The list with the item at `index` moved to the end; what was behind it moves up. */
export function sendToBack<T>(list: T[], index: number): T[] {
  if (index < 0 || index >= list.length - 1) return list;
  return [...list.slice(0, index), ...list.slice(index + 1), list[index]];
}

/** Skipping is offered once per picture, and only while something is behind it. */
export function canSkip(id: string, index: number, total: number, skipped: ReadonlySet<string>): boolean {
  return !skipped.has(id) && index + 1 < total;
}
