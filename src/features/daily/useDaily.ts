import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/shared/lib/supabase";
import { useAuth } from "@/app/providers/AuthProvider";
import { loadByIds } from "@/features/play/content";
import type { PlayItem } from "@/features/play/types";
import { today } from "@/features/play/streak";
import { attempt } from "@/shared/lib/write";

export interface DailyStanding {
  user_id: string;
  username: string;
  score: number;
  correct: number;
  ms: number;
}

/**
 * The same ten questions for everyone, once a day. One attempt: a score you can
 * retake after seeing the board is not a score anyone can be compared against.
 */
export function useDaily() {
  const { user } = useAuth();
  const day = today();
  const [items, setItems] = useState<PlayItem[] | null>(null);
  const [board, setBoard] = useState<DailyStanding[]>([]);
  const [mine, setMine] = useState<DailyStanding | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const readBoard = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase
      .from("daily_scores")
      .select("user_id, score, correct, ms, profiles(username)")
      .eq("day", day)
      // Ranked on correct answers, with time as the tiebreak. Score is
      // speed-and-streak weighted, which is right for a solo round and wrong
      // for a shared one: a tester clicking instantly scored 1992 on 2 of 10
      // and beat 920 on 9 of 10. On a board everyone plays, being right has to
      // be what wins.
      .order("correct", { ascending: false })
      .order("ms", { ascending: true })
      .limit(50);
    const rows: DailyStanding[] = (data ?? []).map((r: Record<string, unknown>) => ({
      user_id: r.user_id as string,
      username: (r.profiles as { username?: string } | null)?.username ?? "someone",
      score: r.score as number,
      correct: r.correct as number,
      ms: (r.ms as number) ?? 0,
    }));
    setBoard(rows);
    const found = rows.find((r) => r.user_id === user?.id) ?? null;
    if (found || !user) { setMine(found); return; }
    // A player ranked past the top 50 is still someone who has played today.
    // Relying on the truncated board to spot them let a low-scorer replay the
    // round; fetch their own row directly so the "already played" gate holds.
    const { data: own } = await supabase
      .from("daily_scores")
      .select("user_id, score, correct, ms, profiles(username)")
      .eq("day", day)
      .eq("user_id", user.id)
      .maybeSingle();
    const o = own as Record<string, unknown> | null;
    setMine(o ? {
      user_id: o.user_id as string,
      username: (o.profiles as { username?: string } | null)?.username ?? "you",
      score: o.score as number,
      correct: o.correct as number,
      ms: (o.ms as number) ?? 0,
    } : null);
  }, [day, user?.id]);

  useEffect(() => {
    if (!supabase || !user) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: ids, error: e } = await supabase!.rpc("daily_round", { p_day: day });
      if (cancelled) return;
      if (e) { setError(`Today's round didn't load: ${e.message}`); setLoading(false); return; }
      if (!ids || (ids as number[]).length === 0) {
        setError("There aren't enough live questions for a daily round yet.");
        setLoading(false); return;
      }
      setItems(await loadByIds(ids as number[]));
      await readBoard();
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [day, user?.id, readBoard]);

  const submit = useCallback(async (score: number, correct: number, answered: number, ms: number) => {
    if (!supabase) return;
    const msg = await attempt("Filing your score",
      supabase.rpc("submit_daily", {
        p_day: day, p_score: score, p_correct: correct, p_answered: answered, p_ms: ms,
      }));
    if (msg) setError(msg);
    await readBoard();
  }, [day, readBoard]);

  return { day, items, board, mine, error, loading, submit, refresh: readBoard };
}

/**
 * Just enough for Home to say whether today is still to be played — without
 * pulling the questions down on every visit to the home page.
 */
export function useDailyStatus() {
  const { user } = useAuth();
  const day = today();
  const [played, setPlayed] = useState<number | null>(null);
  const [players, setPlayers] = useState(0);
  const [faces, setFaces] = useState<{ user_id: string; username: string }[]>([]);

  useEffect(() => {
    if (!supabase || !user) return;
    let cancelled = false;
    (async () => {
      const [mine, all] = await Promise.all([
        supabase!.from("daily_scores").select("correct").eq("day", day).eq("user_id", user.id).maybeSingle(),
        supabase!.from("daily_scores")
          .select("user_id, profiles(username)", { count: "exact" })
          .eq("day", day).order("correct", { ascending: false }).limit(4),
      ]);
      if (cancelled) return;
      setPlayed((mine.data as { correct: number } | null)?.correct ?? null);
      setPlayers(all.count ?? 0);
      setFaces(((all.data ?? []) as Record<string, unknown>[]).map((r) => ({
        user_id: r.user_id as string,
        username: (r.profiles as { username?: string } | null)?.username ?? "?",
      })));
    })();
    return () => { cancelled = true; };
  }, [day, user?.id]);

  return { played, players, faces, signedIn: !!user };
}
