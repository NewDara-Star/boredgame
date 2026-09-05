import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/shared/lib/supabase";
import { today } from "@/features/play/streak";
import {
  dailyPuzzle, encodeLog, isSolved, newGame, pour, puzzleFor, solvedCount, undo, whyNot,
  type Game, type Level,
} from "./rules";
import type { Refusal } from "./Board";

export interface Standing {
  user_id: string; username: string; ms: number; moves: number;
  /** 1-based, on today's board for this level */
  position: number;
  /** the replay, when the referee kept one */
  log: string | null;
}

/**
 * Today's tubes, against the clock.
 *
 * One board per level per day, the same for everyone who opens it, so a time
 * on it sits next to other people's. The clock on screen starts at the first
 * lift; the clock that COUNTS is the server's — an attempt row is written at
 * the first lift and the edge function stamps the finish after replaying the
 * moves, so the time on the board is never a number this phone chose.
 *
 * Going again is a fresh attempt at the same board. Your best stands.
 *
 * Practice is the same game off the record: a random board from the bank,
 * timed here only, no attempt row, no ladder. `shuffle()` deals another.
 */
export function useSortSolo(level: Level, userId: string | undefined, practice = false) {
  const day = today();
  const [randomSeed, setRandomSeed] = useState(() => Date.now());
  const puzzle = useMemo(
    () => (practice ? puzzleFor(randomSeed, level) : dailyPuzzle(day, level)),
    [practice, randomSeed, day, level],
  );

  const [me, setMe] = useState<Game>(() => newGame(puzzle));
  const [selected, setSelected] = useState<number | null>(null);
  const [refused, setRefused] = useState<Refusal | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [result, setResult] = useState<{ ms: number; moves: number; server: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const attempt = useRef<Promise<number | null> | null>(null);

  const [board, setBoard] = useState<Standing[]>([]);
  const [mine, setMine] = useState<Standing | null>(null);

  const reset = useCallback(() => {
    setMe(newGame(puzzle)); setSelected(null); setRefused(null);
    setStartedAt(null); setResult(null); setError(null); setFinishing(false);
    attempt.current = null;
  }, [puzzle]);
  useEffect(() => { reset(); }, [reset]);

  /** Everyone's best on this board, and where you stand — even off the page. */
  const loadBoard = useCallback(async () => {
    if (!supabase || practice) { setBoard([]); setMine(null); return; }
    const { data } = await supabase.from("sort_daily_best")
      .select("user_id, username, ms, moves, log")
      .eq("day", day).eq("level", level)
      .order("ms", { ascending: true }).order("moves", { ascending: true }).limit(20);
    const rows: Standing[] = (data ?? []).map((r, i) => ({ ...r, position: i + 1 }));
    setBoard(rows);
    if (!userId) { setMine(null); return; }
    const onPage = rows.find((r) => r.user_id === userId);
    if (onPage) { setMine(onPage); return; }
    const { data: own } = await supabase.from("sort_daily_best")
      .select("user_id, username, ms, moves, log").eq("day", day).eq("level", level).eq("user_id", userId).maybeSingle();
    if (!own) { setMine(null); return; }
    const { count } = await supabase.from("sort_daily_best")
      .select("user_id", { count: "exact", head: true }).eq("day", day).eq("level", level).lt("ms", own.ms);
    setMine({ ...own, position: (count ?? 0) + 1 });
  }, [day, level, userId, practice]);
  useEffect(() => { void loadBoard(); }, [loadBoard]);

  /** The first lift starts the clock — here, and as a row on the server. */
  const start = useCallback(() => {
    setStartedAt(Date.now());
    if (!supabase || !userId || practice) { attempt.current = Promise.resolve(null); return; }
    attempt.current = Promise.resolve(supabase.rpc("sort_solo_start", { p_day: day, p_level: level }))
      .then(({ data, error: e }) => {
        if (e) { setError("The clock could not start on the server — this run will not be ranked."); return null; }
        return Number(data);
      });
  }, [day, level, userId, practice]);

  /** Sorted. The moves go to the referee; the time comes back from it. */
  const finish = useCallback(async (g: Game, localMs: number) => {
    setFinishing(true);
    const id = await (attempt.current ?? Promise.resolve(null));
    if (!supabase || id === null) {
      setResult({ ms: localMs, moves: g.moves, server: false });
      setFinishing(false);
      return;
    }
    const { data, error: e } = await supabase.functions.invoke("sort-finish", {
      body: { solo: id, moves: g.history.map((h) => [h.from, h.to]), claimed: g.moves, log: encodeLog(g.log) },
    });
    if (e || !data?.ms) {
      setError("That finish did not reach the board — your time here is your own.");
      setResult({ ms: localMs, moves: g.moves, server: false });
    } else {
      setResult({ ms: Number(data.ms), moves: Number(data.moves ?? g.moves), server: true });
      void loadBoard();
    }
    setFinishing(false);
  }, [loadBoard]);

  /** Tap a tube: the first lifts its top ball, the second drops it there. A
      tube that cannot take it — only ever a full one — refuses visibly. */
  const pick = useCallback((i: number) => {
    if (result || finishing) return;
    if (selected === null) {
      if (me.tubes[i].length === 0) return;
      if (startedAt === null) start();
      setSelected(i);
      return;
    }
    if (selected === i) { setSelected(null); return; }
    if (whyNot(me.tubes, me.cap, selected, i)) { setRefused({ tube: i, at: Date.now() }); return; }
    const now = Date.now();
    const next = pour(me, selected, i, now - (startedAt ?? now));
    setSelected(null);
    setMe(next);
    if (isSolved(next.tubes, next.cap)) void finish(next, now - (startedAt ?? now));
  }, [me, selected, result, finishing, startedAt, start, finish]);

  const takeBack = useCallback(() => {
    if (result || finishing) return;
    setSelected(null);
    const now = Date.now();
    setMe((g) => undo(g, now - (startedAt ?? now)));
  }, [result, finishing, startedAt]);

  const shuffle = useCallback(() => setRandomSeed(Date.now()), []);

  return {
    day, puzzle, me, selected, refused, startedAt, result, error, finishing,
    board, mine, practice,
    progress: solvedCount(me.tubes, me.cap),
    pick, takeBack, again: reset, shuffle,
  };
}
