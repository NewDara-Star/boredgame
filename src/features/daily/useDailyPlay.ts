import { useCallback, useEffect, useRef, useState } from "react";
import { scoreAnswer } from "@/features/play/scoring";
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
 * The daily round, judged on the server. Same shape DailyPage always consumed
 * from useRound, but each answer is settled by daily_answer() -- the browser no
 * longer holds the answer, so it cannot mark its own paper. The per-question
 * reveal (correct / the answer / the explanation) comes straight from that
 * verdict. Score and streak here are for the on-screen HUD only; the score that
 * lands on the board is tallied on the server in submit_daily().
 */
export function useDailyPlay(d: DailyApi, enabled: boolean) {
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<DailyPhase>("loading");
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [last, setLast] = useState<Last | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const startedAt = useRef(Date.now());
  const finalised = useRef(false);

  const items = enabled ? d.items : null;

  useEffect(() => {
    if (!enabled || items === null) { setPhase("loading"); return; }
    if (items.length === 0) { setPhase("empty"); return; }
    setIndex(0); setScore(0); setStreak(0); setLast(null); setPending(null);
    finalised.current = false;
    startedAt.current = Date.now();
    setPhase("playing");
  }, [enabled, items]);

  const current = items ? items[index] : undefined;

  const submit = useCallback(async (given: string) => {
    if (phase !== "playing" || !current || pending !== null) return;
    setPending(given);
    const ms = Date.now() - startedAt.current;
    const v = await d.answer(Number(current.id), given);
    if (!v) { setPending(null); return; } // error already surfaced by useDaily
    const gained = v.correct ? scoreAnswer(ms, streak, 0) : 0;
    setScore((s) => s + gained);
    setStreak((s) => (v.correct ? s + 1 : 0));
    setLast({ correct: v.correct, given, gained, near: false, answer: v.answer, explanation: v.explanation });
    setPending(null);
    setPhase("revealed");
  }, [phase, current, pending, streak, d]);

  const next = useCallback(() => {
    if (!items) return;
    if (index + 1 >= items.length) {
      setPhase("done");
      if (!finalised.current) { finalised.current = true; void d.finalize(); }
      return;
    }
    setIndex((i) => i + 1);
    setLast(null);
    startedAt.current = Date.now();
    setPhase("playing");
  }, [index, items, d]);

  return {
    items: items ?? [], current, index, phase, score, streak, last, pending,
    chosen: last?.given ?? pending, submit, next,
  };
}
