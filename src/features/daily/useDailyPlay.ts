import { LOCK_MS, sleep } from "@/features/play/lockIn";
import { useCallback, useEffect, useRef, useState } from "react";
import { keepGrid, readGrid } from "./grid";
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
  const finalised = useRef(false);
  /** bumped by retry(), to load where the server says you are again */
  const [attemptNo, setAttemptNo] = useState(0);

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
      // The server's running score and streak, so a reload mid-round carries on
      // from where you were rather than from 0.
      setScore(n.score); setStreak(n.streak); setLast(null); setPending(null);
      finalised.current = false;
      setIndex(n.answered);
      setCurrent(n.question);
      setPhase("playing");
    })();
    return () => { cancelled = true; };
  }, [enabled, d.day, attemptNo]); // eslint-disable-line react-hooks/exhaustive-deps

  /** After a failed load or answer: ask the server where you are and carry on.
      An answer that did land is not asked again; one that didn't is served again. */
  const retry = useCallback(() => { d.clearError(); setAttemptNo((n) => n + 1); }, [d]);

  const submit = useCallback(async (given: string) => {
    if (phase !== "playing" || !current || pending !== null) return;
    setPending(given);
    // Sent at once (the server times you from its own clock), but the verdict
    // waits out the locked-in moment so your pick shows on its own first.
    const [v] = await Promise.all([d.answer(Number(current.id), given), sleep(LOCK_MS)]);
    if (!v) { setPending(null); return; } // error surfaced by useDaily
    // The points are the server's, the ones that will be filed: it times you from
    // when it served the question, so the phone's own estimate could differ.
    setScore(v.score);
    setStreak(v.streak);
    setLast({ correct: v.correct, given, gained: v.gained, near: false, answer: v.answer, explanation: v.explanation });
    setGrid((g0) => { const g1 = [...(readGrid(d.day) ?? g0), v.correct]; keepGrid(d.day, g1); return g1; });
    setPending(null);
    setPhase("revealed");
  }, [phase, current, pending, d]);

  const next = useCallback(async () => {
    const n = await d.next();
    if (!n) return;
    if (n.done || !n.question) { finish(); return; }
    setIndex(n.answered);
    setCurrent(n.question);
    setLast(null);
    setPhase("playing");
  }, [d, finish]);

  return {
    current, index, total, phase, score, streak, last, pending, grid,
    chosen: last?.given ?? pending, submit, next, retry,
  };
}
