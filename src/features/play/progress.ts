import { supabase } from "@/shared/lib/supabase";
import type { GameKey, Profile } from "@/shared/types/db";
import type { RoundResult } from "./types";
import { advance, today } from "./streak";

/**
 * Keyed per account, not per browser. A single shared key meant every account
 * signing in on the same machine inherited whatever the previous one had
 * answered, and signing out left the number behind for the next person.
 */
const KEY_PREFIX = "boredgame-progress-v1";
const keyFor = (userId?: string) => `${KEY_PREFIX}:${userId ?? "anon"}`;

export interface LocalProgress {
  answered: number;
  correct: number;
  /** ids seen, capped so the key never grows without bound */
  seen: string[];
  bestScore: Record<string, number>;
  streak: number;
  bestStreak: number;
  /** YYYY-MM-DD in the player's own calendar */
  lastPlayed: string | null;
}

const EMPTY: LocalProgress = {
  answered: 0, correct: 0, seen: [], bestScore: {},
  streak: 0, bestStreak: 0, lastPlayed: null,
};

export function readLocal(userId?: string): LocalProgress {
  try {
    const raw = localStorage.getItem(keyFor(userId));
    return raw ? { ...EMPTY, ...JSON.parse(raw) } : { ...EMPTY };
  } catch { return { ...EMPTY }; }
}

export function writeLocal(p: LocalProgress, userId?: string) {
  try { localStorage.setItem(keyFor(userId), JSON.stringify(p)); } catch { /* private mode */ }
}

/**
 * What a finished round changed. The summary screen needs the before/after pair
 * to know whether to celebrate — asking "what rank am I now" is not enough,
 * since the answer is the same whether you just crossed the line or not.
 */
export interface RoundOutcome {
  answeredBefore: number;
  answeredAfter: number;
  streakBefore: number;
  streak: number;
  /** the server's copy, when signed in — saves refetching it */
  profile: Profile | null;
}

/** Records a finished round locally, and to the database when signed in. */
export async function recordRound(
  game: GameKey, results: RoundResult[], score: number, userId?: string,
): Promise<RoundOutcome> {
  const now = today();
  const p = readLocal(userId);
  const localBefore = { answered: p.answered, streak: p.streak };

  p.answered += results.length;
  p.correct += results.filter((r) => r.correct).length;
  p.seen = Array.from(new Set([...p.seen, ...results.map((r) => r.item.id)])).slice(-500);
  p.bestScore[game] = Math.max(p.bestScore[game] ?? 0, score);
  p.streak = advance(p.streak, p.lastPlayed, now);
  p.bestStreak = Math.max(p.bestStreak, p.streak);
  p.lastPlayed = now;
  writeLocal(p, userId);

  const offline: RoundOutcome = {
    answeredBefore: localBefore.answered,
    answeredAfter: p.answered,
    streakBefore: localBefore.streak,
    streak: p.streak,
    profile: null,
  };
  if (!supabase || !userId) return offline;

  // Read before writing: the attempt rows bump the counters by trigger, so the
  // only moment the previous total exists is now.
  const { data: before } = await supabase
    .from("profiles").select("total_answered, streak").eq("id", userId).single();

  const rows = results
    .filter((r) => /^\d+$/.test(r.item.id))
    .map((r) => ({
      puzzle_id: Number(r.item.id),
      given: r.given,
      ms: r.msTaken,
    }));
  // The server judges each answer against the puzzle and files the attempt with
  // its OWN verdict -- the client no longer declares its own `correct`. Filing a
  // correct row for a question you never answered was how the lifetime counters,
  // and so the leaderboard, could be inflated. See record_round.
  if (rows.length) await supabase.rpc("record_round", { p_rows: rows });

  const { data: after } = await supabase
    .rpc("touch_streak", { p_local_date: now }).single<Profile>();

  if (!after) return offline;
  return {
    answeredBefore: before?.total_answered ?? after.total_answered,
    answeredAfter: after.total_answered,
    streakBefore: before?.streak ?? 0,
    streak: after.streak,
    profile: after,
  };
}
