import { supabase } from "@/shared/lib/supabase";
import type { Profile } from "@/shared/types/db";
import type { RoundResult } from "./types";
import { today } from "./streak";

/**
 * Play from before you had an account comes with you (F17, talk item 3).
 *
 * Signed out, the phone used to keep totals only, so an account made later
 * started at 0 while Home promised "make an account to keep your streak". Now
 * the phone keeps each answer (the question, what was given, the time, the
 * day) and the days played. When an account is made on this phone they go up
 * once, and the server judges every answer itself (carry_over). Signing in to
 * an account that already existed asks first: on a shared phone, the play
 * here may be someone else's.
 *
 * The batch id only stops a retried upload being filed twice. It proves
 * nothing about who played; nothing on a phone can.
 */
const KEY = "bg-carry-v1";
const KEEP_DAYS = 30;        // the server takes nothing older
const MAX_ROWS = 500;        // nor more than this

export interface CarryRow { puzzle_id: number; given: string; ms: number; day: string }
export interface Carry {
  batch: string;
  rows: CarryRow[];
  /** days anything was played here signed out, for the streak (at most 7 count) */
  days: string[];
  best: Record<string, number>;
  /** when an account was last being made on this phone (sign-up or guest) */
  making: number | null;
  /** accounts that said "not mine": not asked again */
  declined: string[];
}

const newBatch = () => {
  try { if (crypto.randomUUID) return crypto.randomUUID(); } catch { /* old browsers */ }
  const h = [...Array(32)].map(() => Math.floor(Math.random() * 16).toString(16)).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20)}`;
};
const empty = (): Carry => ({ batch: newBatch(), rows: [], days: [], best: {}, making: null, declined: [] });

/** The first day the server still takes, in the phone's calendar. */
function cutoff(now = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - KEEP_DAYS);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function readCarry(): Carry {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const c = { ...empty(), ...JSON.parse(raw) } as Carry;
    const from = cutoff();
    c.rows = (Array.isArray(c.rows) ? c.rows : []).filter((r) => r && r.day >= from);
    c.days = (Array.isArray(c.days) ? c.days : []).filter((d) => d >= from);
    return c;
  } catch { return empty(); }
}

function writeCarry(c: Carry) {
  try { localStorage.setItem(KEY, JSON.stringify(c)); } catch { /* private mode */ }
}

/** True when there is anything here worth sending. */
export const hasCarry = (c = readCarry()) => c.rows.length > 0 || c.days.length > 0;

/** A round finished while signed out: keep what the server will need to judge it. */
export function keepSignedOut(game: string, results: RoundResult[], score: number | null, day = today()) {
  const c = readCarry();
  for (const r of results) {
    if (!/^\d+$/.test(r.item.id)) continue;                 // bundled questions have no server id
    c.rows.push({ puzzle_id: Number(r.item.id), given: r.given, ms: Math.round(r.msTaken), day });
  }
  c.rows = c.rows.slice(-MAX_ROWS);
  if (!c.days.includes(day)) c.days.push(day);
  if (score !== null && score > 0) c.best[game] = Math.max(c.best[game] ?? 0, score);
  writeCarry(c);
}

/** Sign-up and guest call this just before the account is made, so the new
    account takes the play here without being asked. */
export function markMaking() {
  const c = readCarry();
  if (!hasCarry(c)) return;
  c.making = Date.now();
  writeCarry(c);
}

/** Made on this phone in the last few minutes: the play here is theirs. */
export function madeHere(createdAt: string | undefined, c = readCarry()): boolean {
  if (!c.making || !createdAt) return false;
  const made = Date.parse(createdAt);
  const MIN = 10 * 60_000;
  return Date.now() - c.making < MIN && Math.abs(made - c.making) < MIN;
}

export function decline(userId: string) {
  const c = readCarry();
  if (!c.declined.includes(userId)) c.declined.push(userId);
  c.making = null;
  writeCarry(c);
}

/**
 * Sends the phone's play to the signed-in account. On success the phone's
 * copy is gone (it's the account's now); on failure it stays for next time,
 * with the same batch id, so a request that landed but whose answer was lost
 * isn't filed twice.
 */
export async function sendCarry(): Promise<Profile | null> {
  if (!supabase) return null;
  const c = readCarry();
  if (!hasCarry(c)) return null;
  const { data, error } = await supabase.rpc("carry_over", {
    p_batch: c.batch, p_rows: c.rows, p_days: c.days, p_best: c.best, p_local_date: today(),
  }).single<Profile>();
  if (error || !data) { console.error("carry_over failed", error?.message); return null; }
  try { localStorage.removeItem(KEY); } catch { /* private mode */ }
  return data;
}
