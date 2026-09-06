import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/app/providers/AuthProvider";
import type { GameKey } from "@/shared/types/db";
import { isCorrect, closeness } from "@/shared/lib/normalise";
import { logNearMiss } from "@/features/play/nearMiss";
import { loadContent, shuffle } from "./content";
import { readLocal, recordRound, type RoundOutcome } from "./progress";
import { scoreAnswer } from "./scoring";
import type { PlayItem, RoundResult } from "./types";

export type Phase = "loading" | "empty" | "playing" | "revealed" | "done";

export function useRound(
  game: GameKey, size: number, categories: string[] = [],
  /** an exact list to play, in order — the daily round. Bypasses the pool. */
  fixed?: PlayItem[] | null,
) {
  const { user, applyProfile } = useAuth();
  const userId = user?.id;
  const [items, setItems] = useState<PlayItem[]>([]);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("loading");
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [results, setResults] = useState<RoundResult[]>([]);
  const [outcome, setOutcome] = useState<RoundOutcome | null>(null);
  const [available, setAvailable] = useState<{ name: string; count: number }[]>([]);
  const [last, setLast] = useState<{ correct: boolean; given: string; gained: number; near: boolean } | null>(null);
  const startedAt = useRef(Date.now());

  const build = useCallback(async () => {
    setPhase("loading");
    if (fixed) {
      // No shuffle, no seen-filter: everyone plays the same list in the same
      // order or the scores are not comparable.
      setItems(fixed);
      setIndex(0); setScore(0); setStreak(0); setBestStreak(0);
      setResults([]); setLast(null); setHintsUsed(0); setOutcome(null);
      startedAt.current = Date.now();
      setPhase(fixed.length ? "playing" : "empty");
      return;
    }
    const everything = await loadContent(game);
    // Derived from the pool we already have rather than a second query, so the
    // counts can never disagree with what the round can actually serve.
    const tally = new Map<string, number>();
    for (const i of everything) if (i.category) tally.set(i.category, (tally.get(i.category) ?? 0) + 1);
    setAvailable([...tally].map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count));

    const all = categories.length
      ? everything.filter((i) => categories.includes(i.category))
      : everything;
    if (all.length === 0) { setPhase("empty"); return; }
    // Scoped to the account, not the browser: an unscoped seen-list meant one
    // account's history quietly suppressed questions for another on the same machine.
    const seen = new Set(readLocal(userId).seen);
    const fresh = all.filter((i) => !seen.has(i.id));
    const pool = fresh.length >= size ? fresh : all;
    setItems(shuffle(pool).slice(0, Math.min(size, pool.length)));
    setIndex(0); setScore(0); setStreak(0); setBestStreak(0);
    setResults([]); setLast(null); setHintsUsed(0); setOutcome(null);
    startedAt.current = Date.now();
    setPhase("playing");
  }, [game, size, userId, categories.join("|"), fixed?.map((i) => i.id).join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { void build(); }, [build]);

  const current = items[index];

  const submit = useCallback((given: string) => {
    if (phase !== "playing" || !current) return;
    const ms = Date.now() - startedAt.current;
    const ok = current.choices
      ? given === current.answer
      : isCorrect(given, current.answer, current.accept);
    const gained = ok ? scoreAnswer(ms, streak, hintsUsed) : 0;
    // A multiple-choice miss is a wrong pick, never a "so close" typo -- only
    // typed answers can be near misses.
    const near = !ok && !current.choices && closeness(given, current.answer, current.accept) > 0.7;

    setScore((s) => s + gained);
    setStreak((s) => {
      const n = ok ? s + 1 : 0;
      setBestStreak((b) => Math.max(b, n));
      return n;
    });
    // Every accept list in the bank is a guess until this has something in it.
    if (!ok) logNearMiss(current, given);
    setResults((r) => [...r, { item: current, correct: ok, given, msTaken: ms, hintsUsed }]);
    setLast({ correct: ok, given, gained, near });
    setPhase("revealed");
  }, [phase, current, streak, hintsUsed]);

  const next = useCallback(() => {
    if (index + 1 >= items.length) {
      setPhase("done");
      return;
    }
    setIndex((i) => i + 1);
    setHintsUsed(0);
    setLast(null);
    startedAt.current = Date.now();
    setPhase("playing");
  }, [index, items.length]);

  // Persist once, when the round actually ends.
  const saved = useRef(false);
  useEffect(() => {
    if (phase === "done" && !saved.current) {
      saved.current = true;
      void recordRound(game, results, score, userId).then((o) => {
        setOutcome(o);
        if (o.profile) applyProfile(o.profile);
      });
    }
    if (phase === "playing") saved.current = false;
  }, [phase, game, results, score, userId, applyProfile]);

  return {
    items, current, index, phase, score, streak, bestStreak, results, last, outcome,
    categories: available,
    hintsUsed, useHint: () => setHintsUsed((h) => h + 1),
    submit, next, restart: build,
  };
}
