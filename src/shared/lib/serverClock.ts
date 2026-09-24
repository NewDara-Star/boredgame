import { supabase } from "./supabase";

/**
 * How far this phone's clock is from the server's.
 *
 * A room's question clock starts at the time the server stamped on the move
 * (the game tables stamp updated_at themselves). Comparing that with a phone's
 * own clock is only right if the phone's clock is right: one a few seconds off
 * saw the other player's bar start part-empty, and the take-over rescue and the
 * "hasn't been seen" notice fired early or late. So each phone asks the server
 * the time a few times, keeps the fastest answer (the least time in flight)
 * and corrects every server timestamp by the difference.
 */
let offset = 0;          // server time minus this phone's time, ms
let syncedAt = 0;
let inflight: Promise<void> | null = null;
export const RESYNC_MS = 10 * 60_000;

export const clockOffset = () => offset;

/** Sync at most every ten minutes; calls made meanwhile share one sync. */
export function syncClock(samples = 3): Promise<void> {
  if (!supabase || Date.now() - syncedAt < RESYNC_MS) return Promise.resolve();
  if (inflight) return inflight;
  inflight = (async () => {
    let best: { rtt: number; off: number } | null = null;
    for (let k = 0; k < samples; k++) {
      const t0 = Date.now();
      const { data, error } = await supabase!.rpc("server_now");
      const t1 = Date.now();
      if (error || typeof data !== "string") continue;
      const off = Date.parse(data) - (t0 + t1) / 2;
      if (!best || t1 - t0 < best.rtt) best = { rtt: t1 - t0, off };
    }
    if (best) { offset = best.off; syncedAt = Date.now(); }
  })().finally(() => { inflight = null; });
  return inflight;
}

/** A server timestamp as this phone's clock would have read it. */
export const serverToLocal = (iso: string) => Date.parse(iso) - offset;
/** Now, on the server's clock, for a stamp this phone writes before the server's arrives. */
export const serverNowIso = () => new Date(Date.now() + offset).toISOString();
