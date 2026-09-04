/**
 * Day streaks, in the player's own calendar — not UTC's.
 *
 * A streak that breaks at 1am because the server counts days in London is the
 * fastest way to make someone stop trusting the number, so the client decides
 * what "today" is and the server only sanity-checks it (see touch_streak).
 */

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Today, as the player's device sees it. */
export const today = () => iso(new Date());

/** The day after `day`. Built in UTC so a clock change never adds or eats one. */
function nextDay(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + 1));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(t.getUTCDate()).padStart(2, "0")}`;
}

/** What a streak becomes when someone plays on `now`, having last played on `last`. */
export function advance(streak: number, last: string | null, now = today()): number {
  if (!last) return 1;
  if (now <= last) return Math.max(streak, 1); // already counted today
  return now === nextDay(last) ? streak + 1 : 1;
}

/** True while the run is still alive — played today, or yesterday and not yet back. */
export function isAlive(last: string | null, now = today()): boolean {
  return !!last && (last === now || nextDay(last) === now);
}

export interface Milestone { days: number; name: string }

/**
 * Deliberately front-loaded. Three days is reachable by accident, which is the
 * point — the first badge has to land before the habit does.
 */
export const MILESTONES: Milestone[] = [
  { days: 3,   name: "Warmed up" },
  { days: 7,   name: "A full week" },
  { days: 14,  name: "Fortnight" },
  { days: 30,  name: "A month" },
  { days: 60,  name: "Two months" },
  { days: 100, name: "Hundred days" },
];

/** The milestone a streak of `days` has just landed on, if any. */
export const milestoneAt = (days: number) => MILESTONES.find((m) => m.days === days) ?? null;
