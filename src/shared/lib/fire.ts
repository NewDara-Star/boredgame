/**
 * Send a call you do not intend to wait for.
 *
 * `supabase.rpc(...)` does not return a Promise. It returns a LAZY builder
 * that only performs the request inside `.then()`. So `void supabase.rpc(…)`
 * — which reads exactly like fire-and-forget, and was written that way twice —
 * builds a request and never sends it. Nothing throws, nothing logs, no
 * request appears in the network tab or the server's logs. The call simply
 * does not happen.
 *
 * It cost two things silently. `sort_move` posts your board to the other phone
 * on every pour: in a Ball Sort room neither player ever saw the other move,
 * so the one room that is meant to be simultaneous was two people playing
 * alone. And `touch_presence` is the heartbeat behind "hasn't been seen for
 * two minutes": it never beat once, in any room mode, so both players went
 * away from each other's screens two minutes after joining. Server logs for a
 * whole day of play contain zero calls to either.
 *
 * Both looked right in review, which is the point: this is not a mistake you
 * catch by reading. `scripts/check-fire.mts` fails the build if a bare
 * `void supabase…` comes back.
 */
export function fire(call: PromiseLike<unknown>, what: string): void {
  // Promise.resolve() on a thenable calls .then() — which is what sends it.
  void Promise.resolve(call).then(
    (r) => {
      const e = (r as { error?: { message?: string } } | null)?.error;
      if (e) console.warn(`${what} did not land: ${e.message ?? "unknown error"}`);
    },
    (e: unknown) => console.warn(`${what} did not land: ${String(e)}`),
  );
}

/**
 * Why the referee said no.
 *
 * `functions.invoke` reports a non-2xx as an error whose `context` is the
 * Response — the JSON body, with the reason in it, is in there and is thrown
 * away by anyone who only reads `error.message`. Both finish handlers did,
 * so "move 12 is not a legal pour" and "the browser blocked the request"
 * reached the player as the same sentence, and the CORS bug above sat behind
 * that sentence for its whole life.
 */
export async function refusal(err: unknown): Promise<string | null> {
  const ctx = (err as { context?: unknown } | null)?.context;
  if (!ctx || typeof (ctx as Response).json !== "function") return null;
  try {
    const body = await (ctx as Response).json();
    const why = (body as { error?: unknown })?.error;
    return typeof why === "string" && why ? why : null;
  } catch {
    return null;   // not JSON, or the body was already consumed
  }
}
