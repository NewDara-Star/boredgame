import { useCallback } from "react";
import { supabase } from "@/shared/lib/supabase";
import { useAuth } from "@/app/providers/AuthProvider";
import type { Profile } from "@/shared/types/db";
import { today } from "./streak";

/**
 * Playing any game keeps your streak (talk item 1, decided 24 Sep): solo, the
 * Daily, rooms, and the games with no questions (Tic Tac Toe, Connect 4,
 * Memory, Ball Sort). Before, only answering a question moved it, so a day
 * spent in rooms with a friend broke it.
 *
 * touch_streak only moves the streak once a day, so this asks at most once a
 * day per person on this phone and hands the header the profile it returns.
 */
let marked: { day: string; user: string } | null = null;

export function useMarkPlayed() {
  const { user, applyProfile } = useAuth();
  return useCallback(async () => {
    if (!supabase || !user) return;
    const day = today();
    if (marked && marked.day === day && marked.user === user.id) return;
    marked = { day, user: user.id };
    const { data, error } = await supabase.rpc("touch_streak", { p_local_date: day }).single<Profile>();
    if (error || !data) { marked = null; return; }
    applyProfile(data);
  }, [user, applyProfile]);
}

/**
 * A question answered in a board room (Square Off, Connect 4 with questions)
 * counts like one answered solo: the server judges what was picked and files
 * it, the same record_round a solo round uses. One retry, as solo does. Race
 * rooms need none of this: claim_round files their answers on the server.
 */
export async function fileRoomAnswer(puzzleId: number, given: string, ms: number): Promise<void> {
  if (!supabase) return;
  const rows = [{ puzzle_id: puzzleId, given, ms: Math.max(0, Math.round(ms)) }];
  let { error } = await supabase.rpc("record_round", { p_rows: rows });
  if (error) {
    await new Promise((r) => setTimeout(r, 1500));
    ({ error } = await supabase.rpc("record_round", { p_rows: rows }));
  }
  if (error) console.error("[BoredGame] a room answer wasn't filed", error);
}
