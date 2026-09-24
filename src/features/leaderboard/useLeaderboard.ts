import { useEffect, useState } from "react";
import { supabase } from "@/shared/lib/supabase";
import { isAlive } from "@/features/play/streak";

/** A profile keeps its last streak until its owner plays again, so a run that
    ended a week ago would still read "3-day streak" here. Your own screens hide
    a dead one with isAlive; the board has to say the same thing. */
const liveStreak = (r: { streak: number; last_played: string | null }) =>
  isAlive(r.last_played) ? r.streak : 0;

export interface Standing {
  id: string;
  username: string;
  answered: number;
  correct: number;
  streak: number;
  /** 1-based position in the whole table, not just the page shown */
  position: number;
}

export interface Board {
  rows: Standing[];
  /** Where the signed-in player sits, even when that is off the bottom of the page. */
  you: Standing | null;
  loading: boolean;
  /** The board didn't load. An empty list must never stand in for this: it
      used to say "Nobody has played yet" to someone with no signal. */
  failed: boolean;
  retry(): void;
}

/**
 * Ranked on questions answered rather than accuracy or score. Accuracy rewards
 * answering less, and score rewards playing the easy tier — turning up is the
 * behaviour worth putting at the top of a list.
 */
export function useLeaderboard(userId?: string, limit = 50): Board {
  const [rows, setRows] = useState<Standing[]>([]);
  const [you, setYou] = useState<Standing | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, total_answered, total_correct, streak, last_played")
        .gt("total_answered", 0)
        // Guests have a name but not an account. Ranking them would put a row
        // on the board that nobody can ever sign back in to.
        .eq("is_guest", false)
        // id last so the order is stable between loads instead of shuffling ties.
        .order("total_answered", { ascending: false })
        .order("total_correct", { ascending: false })
        .order("id", { ascending: true })
        .limit(limit);
      if (cancelled) return;
      if (error) { setFailed(true); setRows([]); setYou(null); setLoading(false); return; }
      setFailed(false);

      const list: Standing[] = (data ?? []).map((r, i) => ({
        id: r.id,
        username: r.username,
        answered: r.total_answered,
        correct: r.total_correct,
        streak: liveStreak(r),
        position: i + 1,
      }));
      setRows(list);

      if (!userId) { setYou(null); setLoading(false); return; }
      const onPage = list.find((r) => r.id === userId);
      if (onPage) { setYou(onPage); setLoading(false); return; }

      // Off the page: ask how many people are ahead rather than pulling the
      // whole table down to count them.
      const { data: me } = await supabase
        .from("profiles")
        .select("id, username, total_answered, total_correct, streak, last_played")
        .eq("id", userId).single();
      // A signed-in user with no profile row is a real state — the trigger can
      // fail, or the row can be deleted — and it used to produce a Standing of
      // undefineds that crashed the whole screen.
      if (cancelled || !me || typeof me.total_answered !== "number") { setLoading(false); return; }
      const { count } = await supabase
        .from("profiles").select("id", { count: "exact", head: true })
        // Match the board's population: it excludes guests, so the "people ahead"
        // count must too, or an off-page player sees a rank inflated by guests
        // the board never shows.
        .eq("is_guest", false)
        .gt("total_answered", me.total_answered);
      if (cancelled) return;
      setYou({
        id: me.id, username: me.username, answered: me.total_answered,
        correct: me.total_correct, streak: liveStreak(me), position: (count ?? 0) + 1,
      });
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [userId, limit, tick]);

  return { rows, you, loading, failed, retry: () => setTick((t) => t + 1) };
}
