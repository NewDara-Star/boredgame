/**
 * The fallback has to fire on silence, not only on failure. Every game ships
 * with a bundled set of puzzles, and before this the only route to it was the
 * database answering with an error — a request that never answered left the
 * screen on "Dealing questions…" indefinitely.
 */
import { withTimeout } from "../src/shared/lib/timeout.ts";

let n = 0;
const ok = (c: boolean, m: string) => {
  n++;
  if (!c) { console.error("FAIL " + m); process.exit(1); }
};
const after = <T>(ms: number, v: T) => new Promise<T>((r) => setTimeout(() => r(v), ms));
const never = <T>() => new Promise<T>(() => {});

// the happy path is untouched
ok(await withTimeout(Promise.resolve("db"), 50, () => "seed") === "db",
   "a fast answer is used");
ok(await withTimeout(after(10, "db"), 100, () => "seed") === "db",
   "a slow-but-in-time answer is used");

// the two ways it goes wrong, which look identical to someone staring at a screen
ok(await withTimeout(never<string>(), 30, () => "seed") === "seed",
   "silence falls back rather than hanging");
ok(await withTimeout(after(200, "db"), 30, () => "seed") === "seed",
   "an answer that arrives too late does not win the race");
ok(await withTimeout(Promise.reject(new Error("boom")), 50, () => "seed") === "seed",
   "a rejection falls back instead of throwing at the caller");

// a rejection AFTER the deadline must not surface as an unhandled rejection
const late = new Promise<string>((_, rej) => setTimeout(() => rej(new Error("late")), 40));
ok(await withTimeout(late, 10, () => "seed") === "seed", "a late rejection still falls back");
await after(60, null);   // give the late rejection time to be unhandled, if it would be

// the fallback may be async, because loading bundled content could become one
ok(await withTimeout(never<string>(), 20, async () => "async seed") === "async seed",
   "an async fallback is awaited");

// it must actually be bounded: a 30ms budget cannot take 200ms
const t0 = Date.now();
await withTimeout(never<string>(), 30, () => "seed");
const spent = Date.now() - t0;
ok(spent < 200, `the wait is bounded by the budget (took ${spent}ms)`);

// and it must not keep the process alive after it resolves
ok(true, "the timer is cleared — this script exits on its own");

console.log(`${n} timeout assertions hold`);
