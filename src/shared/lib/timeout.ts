/**
 * Give up waiting and use what we already have.
 *
 * Every game falls back to bundled content when the database returns an error —
 * but a request that never comes back is not an error, and awaiting it means
 * the screen sits on "Dealing questions…" until the tab is closed. Patchy phone
 * signal and captive-portal wifi both produce exactly that, and both are how
 * this app gets played.
 *
 * Import-free so scripts/check-timeout.mts can load it under bare Node.
 */
export async function withTimeout<T>(
  work: Promise<T>, ms: number, fallback: () => T | Promise<T>,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expired = Symbol("expired");
  try {
    const raced = await Promise.race([
      work.catch(() => expired),
      new Promise<typeof expired>((res) => { timer = setTimeout(() => res(expired), ms); }),
    ]);
    // A rejection lands here too: both "it broke" and "it never answered" mean
    // the same thing to a player waiting at a blank screen.
    return raced === expired ? await fallback() : (raced as T);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
