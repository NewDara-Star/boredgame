import { supabase } from "@/shared/lib/supabase";
import { nearMiss } from "@/shared/lib/normalise";
import type { PlayItem } from "./types";

/**
 * Record a wrong answer that looks like a right one.
 *
 * The accept lists on every puzzle are my guesses about how people phrase
 * things. This is how they stop being guesses: the answers people actually type
 * and are told are wrong, ranked by how often. Read it with
 *
 *   select p.answer, n.guess, n.hits from near_misses n
 *   join puzzles p on p.id = n.puzzle_id order by n.hits desc limit 40;
 *
 * and promote whatever is obviously the same phrase.
 *
 * Only near misses are sent. A guess nowhere near the answer says nothing about
 * phrasing and would be most of the volume. Fire-and-forget on purpose: a
 * player waiting on analytics is a worse bug than a lost row, and the write is
 * anonymous — normalised text and a puzzle id, nothing else.
 */
export function logNearMiss(item: PlayItem, given: string) {
  if (!supabase) return;
  if (!/^\d+$/.test(item.id)) return;          // bundled puzzle, not a database row
  if (!nearMiss(given, item.answer, item.accept)) return;
  void supabase.rpc("log_near_miss", { p_puzzle: Number(item.id), p_guess: given })
    .then(() => {}, () => {});                  // never surfaces, never blocks
}
