/**
 * Every write in a room goes through here.
 *
 * Before this, every `await supabase.from(...)` discarded its result. A refused
 * write and a hang look identical on screen — the board simply never moves —
 * which is why every bug in this app felt like a freeze, and why an expired
 * session was indistinguishable from a broken game.
 */
interface Failure { message: string; code?: string }
interface Result { error: Failure | null }

function friendly(label: string, err: Failure): string {
  const m = (err.message ?? "").toLowerCase();
  if (err.code === "PGRST301" || m.includes("jwt") || m.includes("token is expired"))
    return "Your sign-in has expired. Open the Profile tab and sign in again.";
  if (err.code === "42501" || m.includes("row-level security") || m.includes("not a member"))
    return `${label} was refused — you may no longer be in this room.`;
  if (m.includes("failed to fetch") || m.includes("network") || m.includes("load failed"))
    return `${label} didn't send. Check your connection — it will work once you're back.`;
  return `${label} didn't go through: ${err.message}`;
}

/** Returns null when the write landed, or a sentence to put on screen. */
export async function attempt(label: string, run: PromiseLike<Result>): Promise<string | null> {
  try {
    const { error } = await run;
    if (!error) return null;
    console.error(`[BoredGame] ${label} failed`, error);
    return friendly(label, error);
  } catch (e) {
    console.error(`[BoredGame] ${label} threw`, e);
    return `${label} didn't send. Check your connection — it will work once you're back.`;
  }
}
