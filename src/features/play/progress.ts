import { supabase } from "@/shared/lib/supabase";
import type { GameKey } from "@/shared/types/db";
import type { RoundResult } from "./types";

const KEY = "boredgame-progress-v1";

export interface LocalProgress {
  answered: number;
  correct: number;
  /** ids seen, capped so the key never grows without bound */
  seen: string[];
  bestScore: Record<string, number>;
}

const EMPTY: LocalProgress = { answered: 0, correct: 0, seen: [], bestScore: {} };

export function readLocal(): LocalProgress {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...EMPTY, ...JSON.parse(raw) } : { ...EMPTY };
  } catch { return { ...EMPTY }; }
}

export function writeLocal(p: LocalProgress) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* private mode */ }
}

/** Records a finished round locally, and to the database when signed in. */
export async function recordRound(game: GameKey, results: RoundResult[], score: number, userId?: string) {
  const p = readLocal();
  p.answered += results.length;
  p.correct += results.filter((r) => r.correct).length;
  p.seen = Array.from(new Set([...p.seen, ...results.map((r) => r.item.id)])).slice(-500);
  p.bestScore[game] = Math.max(p.bestScore[game] ?? 0, score);
  writeLocal(p);

  if (!supabase || !userId) return;
  const rows = results
    .filter((r) => /^\d+$/.test(r.item.id))
    .map((r) => ({
      user_id: userId,
      puzzle_id: Number(r.item.id),
      correct: r.correct,
      ms_taken: r.msTaken,
    }));
  if (rows.length) await supabase.from("attempts").insert(rows);
}
