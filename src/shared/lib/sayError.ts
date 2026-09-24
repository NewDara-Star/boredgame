/**
 * Plain words for a failure (F2). The server's and the browser's own text never
 * reaches the screen: "JWT expired", "Failed to fetch" and "new row violates
 * row-level security policy" mean nothing to a player, and some of it names our
 * tables. The detail goes to the console for whoever is debugging; the player
 * gets one of these sentences, or the caller's own fallback.
 *
 * check-errors.mts fails the build if a raw error message is put on screen.
 */
export function sayError(err: unknown, fallback: string): string {
  const e = (err ?? {}) as { message?: unknown; code?: unknown; status?: unknown };
  const m = String(e.message ?? "").toLowerCase();
  if (m.includes("failed to fetch") || m.includes("load failed") || m.includes("networkerror") || m.includes("network request failed"))
    return "You seem to be offline. Check your connection and try again.";
  if (e.status === 429 || m.includes("rate limit") || m.includes("too many"))
    return "Too many tries in a row. Wait a minute, then try again.";
  if (e.code === "PGRST301" || m.includes("jwt") || m.includes("token is expired") || m.includes("refresh token"))
    return "Your sign-in has run out. Tap your badge at the top right and sign in again.";
  const min = m.match(/password should be at least (\d+)/);
  if (min) return `Use at least ${min[1]} characters for your password.`;
  if (m.includes("password") && (m.includes("weak") || m.includes("pwned") || m.includes("leaked") || m.includes("known")))
    return "That password is too easy to guess. Try a longer one.";
  if (m.includes("different from the old") || m.includes("same password"))
    return "That's already your password.";
  if (m.includes("signups not allowed") || m.includes("signup is disabled"))
    return "New accounts are switched off right now.";
  return fallback;
}

/** Shown when the app was built without a server to talk to. */
export const NO_SERVER = "Can't reach the game server right now.";
