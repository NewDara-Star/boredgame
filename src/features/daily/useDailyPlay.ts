import { useCallback, useEffect, useRef, useState } from "react";
import { scoreAnswer } from "@/features/play/scoring";
import type { PlayItem } from "@/features/play/types";
import type { useDaily } from "./useDaily";

type DailyApi = ReturnType<typeof useDaily>;
export type DailyPhase = "loading" | "empty" | "playing" | "revealed" | "done";

interface Last {
  correct: boolean;
  given: string;
  gained: number;
  near: boolean;
  answer: string;
  explanation?: string;
}

/**
 * The daily round, served and judged and timed on the server. The client asks
 * for one question at a time (d.next), which is what lets "time to answer" be
 * measured honestly: the server stamps when it hands the question over, so the
 * browser cannot have seen it earlier and cannot report a time of its own. The
 * per-question reveal (correct / the answer / the explanation) comes from the
 * server's verdict. score/streak here are for the on-screen HUD only; the score
 * and time that land on the board are computed server-side in submit_daily().
 */
/** Right and wrong in the order they were answered, kept for the day so the
    share grid survives a reload. Only the order lives here; the score is the
    server's. */
const gridKey = (day: string) => `bg-daily-grid-${day}`;
export function readGrid(day: string): boolean[] | null {
  try { const v = JSON.parse(localStorage.getItem(gridKey(day)) ?? "null"); return Array.isArray(v) ? v : null; }
  catch { return null; }
}
function keepGrid(day: string, grid: boolean[]) {
  try { localStorage.setItem(gridKey(day), JSON.stringify(grid)); } catch { /* private mode */ }
}

export function useDailyPlay(d: DailyApi, enabled: boolean) {
  const [phase, setPhase] = useState<DailyPhase>("loading");
  const [current, setCurrent] = useState<PlayItem | undefined>(undefined);
  const [index, setIndex] = useState(0);
  const [total, setTotal] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [last, setLast] = useState<Last | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [grid, setGrid] = useState<boolean[]>([]);
  const shownAt = useRef(Date.now()); // local stopwatch, DISPLAY ONLY (the +N)
  const finalised = useRef(false);

  const finish = useCallback(() => {
    setPhase("done");
    if (!finalised.current) { finalised.current = true; void d.finalize(); }
  }, [d]);

  useEffect(() => {
    if (!enabled) { setPhase("loading"); return; }
    let cancelled = false;
    (async () => {
      setPhase("loading");
      const n = await d.next();
      if (cancelled || !n) return;
      setTotal(n.total);
      if (n.total === 0) { setPhase("empty"); return; }
      if (n.done || !n.question) { finish(); return; }
      setScore(0); setStreak(0); setLast(null); setPending(null);
      finalised.current = false;
      setIndex(n.answered);
      setCurrent(n.question);
      shownAt.current = Date.now();
      setPhase("playing");
    })();
    return () => { cancelled = true; };
  }, [enabled, d.day]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = useCallback(async (given: string) => {
    if (phase !== "playing" || !current || pending !== null) return;
    setPending(given);
    const v = await d.answer(Number(current.id), given);
    if (!v) { setPending(null); return; } // error surfaced by useDaily
    // The +N is a local estimate for feedback only; the score that ranks you is
    // computed on the server from server-measured think-time.
    const gained = v.correct ? scoreAnswer(Date.now() - shownAt.current, streak, 0) : 0;
    setScore((s) => s + gained);
    setStreak((s) => (v.correct ? s + 1 : 0));
    setLast({ correct: v.correct, given, gained, near: false, answer: v.answer, explanation: v.explanation });
    setGrid((g0) => { const g1 = [...(readGrid(d.day) ?? g0), v.correct]; keepGrid(d.day, g1); return g1; });
    setPending(null);
    setPhase("revealed");
  }, [phase, current, pending, streak, d]);

  const next = useCallback(async () => {
    const n = await d.next();
    if (!n) return;
    if (n.done || !n.question) { finish(); return; }
    setIndex(n.answered);
    setCurrent(n.question);
    setLast(null);
    shownAt.current = Date.now();
    setPhase("playing");
  }, [d, finish]);

  return {
    current, index, total, phase, score, streak, last, pending, grid,
    chosen: last?.given ?? pending, submit, next,
  };
}
