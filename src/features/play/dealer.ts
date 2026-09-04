/**
 * Choosing the next puzzle, once.
 *
 * The room used to do this inline:
 *
 *   pool.find(i => !seen.has(i.id)) ?? scoped[0] ?? pool[0]
 *
 * which has two failure modes that both look like the game breaking. Once every
 * item had been served, `find` returned undefined and it handed back `scoped[0]`
 * — the same question, every turn, for the rest of the session. And when the
 * category filter matched nothing, the last fallback quietly served from the
 * whole bank instead, ignoring the filter with no message.
 *
 * Exhaustion is normal and should start a fresh cycle. An empty pool is a
 * misconfiguration and must be reported, never papered over.
 */
export interface Deal<T> {
  item: T | null;
  /** true when this deal began a new cycle because everything had been seen */
  recycled: boolean;
}

export function deal<T>(
  pool: T[],
  idOf: (t: T) => string,
  seen: Set<string>,
  opts: { avoid?: string | null; rand?: () => number } = {},
): Deal<T> {
  if (pool.length === 0) return { item: null, recycled: false };
  const rand = opts.rand ?? Math.random;

  let candidates = pool.filter((p) => !seen.has(idOf(p)));
  let recycled = false;

  if (candidates.length === 0) {
    seen.clear();
    recycled = true;
    // Everything is fair game again, except the one just served — otherwise the
    // last question of a cycle can be the first of the next, back to back.
    candidates = opts.avoid && pool.length > 1
      ? pool.filter((p) => idOf(p) !== opts.avoid)
      : pool.slice();
    if (candidates.length === 0) candidates = pool.slice();
  }

  const item = candidates[Math.floor(rand() * candidates.length)];
  seen.add(idOf(item));
  return { item, recycled };
}
