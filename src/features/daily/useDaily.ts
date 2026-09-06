import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/shared/lib/supabase";
import { useAuth } from "@/app/providers/AuthProvider";
import { shuffleSeeded } from "@/shared/lib/shuffle";
import type { PlayItem } from "@/features/play/types";
import type { RebusSpec, GameKey, Difficulty } from "@/shared/types/db";
import { today } from "@/features/play/streak";
import { attempt } from "@/shared/lib/write";
import { withTimeout } from "@/shared/lib/timeout";

export interface DailyStanding {
  user_id: string;
  username: string;
  score: number;
  correct: number;
  ms: number;
}

/** The verdict the server returns for one answered question. */
export interface DailyVerdict {
  correct: boolean;
  answer: string;
  explanation?: string;
  locked?: boolean;
}

/**
 * Map an answer-free row from daily_puzzles() to a PlayItem. The answer is
 * deliberately absent -- the server holds it and judges every pick, so nothing
 * to compare against ever reaches the browser. Choices are shuffled on the id
 * (stable for everyone) so storage order is never a tell.
 */
function mapDailyRow(r: Record<string, unknown>): PlayItem {
  const id = String(r.id);
  const raw = r.choices;
  const choices = Array.isArray(raw) ? shuffleSeeded(raw as string[], id) : undefined;
  return {
    id,
    game: r.game as GameKey,
    render: r.render as "text" | "image",
    spec: (r.spec as RebusSpec | null) ?? undefined,
    imageUrl: (r.image_url as string | null) ?? undefined,
    prompt: (r.prompt as string | null) ?? undefined,
    choices,
    answer: "", // never sent; judging is server-side
    altHint: (r.alt_hint as string | null) ?? undefined,
    charHint: (r.char_hint as string | null) ?? undefined,
    difficulty: r.difficulty as Difficulty,
    category: (r.category as string | null) ?? "",
  };
}

/**
 * The same ten questions for everyone, once a day. One attempt: a score you can
 * retake after seeing the board is not a score anyone can be compared against.
 * Answers live only on the server now; the browser plays blind and the server
 * judges each pick and tallies the round.
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
      // Ranked on correct answers, with time as the tiebreak.
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
      // Answer-free serving: daily_puzzles() returns the day's questions WITHOUT
      // the answer and records the clock start. Bounded like loadContent so a
      // stalled connection can't leave the screen on "Dealing..." forever.
      const rows = await withTimeout(
        (async () => {
          const { data, error } = await supabase!.rpc("daily_puzzles", { p_day: day });
          if (error) throw error;
          return data as Record<string, unknown>[] | null;
        })(),
        8000, () => null,
      );
      if (cancelled) return;
      if (rows === null) {
        setError("Today's round didn't load. Check your connection and try again.");
        setLoading(false); return;
      }
      if (rows.length === 0) {
        setError("There aren't enough live questions for a daily round yet.");
        setLoading(false); return;
      }
      setItems(rows.map(mapDailyRow));
      await withTimeout(readBoard(), 8000, () => {});
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [day, user?.id, readBoard]);

  /** Judge one pick on the server. The verdict -- including the correct answer,
      for the reveal -- comes back only after the pick is committed, and never
      depends on anything the browser could have faked. */
  const answer = useCallback(async (puzzleId: number, given: string): Promise<DailyVerdict | null> => {
    if (!supabase) return null;
    const { data, error } = await supabase.rpc("daily_answer", {
      p_day: day, p_puzzle: puzzleId, p_given: given,
    });
    if (error) {
      setError("That answer didn't reach the server. Check your connection and try again.");
      return null;
    }
    return data as DailyVerdict;
  }, [day]);

  /** Finalise the board row from the recorded picks (the server tallies and
      times it). One score per day; a second call is a no-op. */
  const finalize = useCallback(async () => {
    if (!supabase) return;
    const msg = await attempt("Filing your score", supabase.rpc("submit_daily", { p_day: day }));
    if (msg) setError(msg);
    await readBoard();
  }, [day, readBoard]);

  return { day, items, board, mine, error, loading, answer, finalize, refresh: readBoard };
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
