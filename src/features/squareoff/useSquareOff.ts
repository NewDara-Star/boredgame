import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/app/providers/AuthProvider";
import { loadContent, shuffle } from "@/features/play/content";
import { recordRound, type RoundOutcome } from "@/features/play/progress";
import type { PlayItem, RoundResult } from "@/features/play/types";
import {
  newGame, pick, answer, advance, botSquare, botIsRight, type Game, type Mark,
} from "./rules";

export const ASK_MS = 15_000;
const BOT_PICK_MS = 850;
const BOT_THINK_MS = 1500;
const BOT_COMMIT_MS = 750;
const REVEAL_MS = 2300;

/**
 * The solo game. Every transition goes through `commit`, which deals a question
 * at the same moment the state becomes "asking" — dealing in a separate effect
 * leaves one render where the phase and the question disagree, and the bot
 * answers the previous question.
 */
export function useSquareOff() {
  const { user } = useAuth();
  const [pool, setPool] = useState<PlayItem[]>([]);
  const [game, setGame] = useState<Game>(() => newGame("x"));
  const [item, setItem] = useState<PlayItem | null>(null);
  const [options, setOptions] = useState<string[]>([]);
  const [chosen, setChosen] = useState<string | null>(null);
  const [left, setLeft] = useState(ASK_MS);
  const [results, setResults] = useState<RoundResult[]>([]);
  const [outcome, setOutcome] = useState<RoundOutcome | null>(null);
  const seen = useRef<Set<string>>(new Set());
  const askedAt = useRef(Date.now());

  // Held in a ref as well as state: `deal` runs inside event handlers and
  // timeouts, where reading it out of a setState updater would fire a side
  // effect twice under StrictMode.
  const poolRef = useRef<PlayItem[]>([]);
  useEffect(() => {
    void loadContent("trivia").then((all) => {
      const usable = shuffle(all.filter((i) => i.choices && i.choices.length >= 2));
      poolRef.current = usable;
      setPool(usable);
    });
  }, []);

  const deal = useCallback(() => {
    const next = poolRef.current.find((i) => !seen.current.has(i.id)) ?? poolRef.current[0];
    if (next) {
      seen.current.add(next.id);
      setItem(next);
      setOptions(shuffle(next.choices!));
    }
    setChosen(null);
    setLeft(ASK_MS);
    askedAt.current = Date.now();
  }, []);

  /** The one door every state change goes through. */
  const commit = useCallback((next: Game) => {
    if (next.phase === "asking" && game.phase !== "asking") deal();
    setGame(next);
  }, [game.phase, deal]);

  const choose = useCallback((square: number) => {
    if (game.phase !== "picking" || game.turn !== "x" || pool.length === 0) return;
    commit(pick(game, square));
  }, [game, pool.length, commit]);

  const submit = useCallback((opt: string | null) => {
    if (game.phase !== "asking" || game.answerer !== "x" || !item) return;
    setChosen(opt);
    setResults((r) => [...r, {
      item, correct: opt === item.answer, given: opt ?? "",
      msTaken: Date.now() - askedAt.current, hintsUsed: 0,
    }]);
    commit(answer(game, opt === item.answer));
  }, [game, item, commit]);

  // --- the bot ---------------------------------------------------------------
  useEffect(() => {
    if (game.phase !== "picking" || game.turn !== "o") return;
    const t = setTimeout(() => commit(pick(game, botSquare(game.board, "o"))), BOT_PICK_MS);
    return () => clearTimeout(t);
  }, [game, commit]);

  useEffect(() => {
    if (game.phase !== "asking" || game.answerer !== "o" || !item) return;
    // Decided up front so the option it highlights is the one it commits to.
    const right = botIsRight(item.difficulty);
    const wrong = options.filter((o) => o !== item.answer);
    const choice = right || wrong.length === 0
      ? item.answer
      : wrong[Math.floor(Math.random() * wrong.length)];
    const t1 = setTimeout(() => setChosen(choice), BOT_THINK_MS);
    const t2 = setTimeout(() => commit(answer(game, choice === item.answer)),
      BOT_THINK_MS + BOT_COMMIT_MS);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [game, item, options, commit]);

  // --- the clock, and moving on ----------------------------------------------
  useEffect(() => {
    if (game.phase !== "asking" || game.answerer !== "x") return;
    const id = setInterval(() => {
      const remaining = ASK_MS - (Date.now() - askedAt.current);
      setLeft(remaining);
      if (remaining <= 0) { clearInterval(id); submit(null); }
    }, 100);
    return () => clearInterval(id);
  }, [game.phase, game.answerer, submit]);

  useEffect(() => {
    if (game.phase !== "revealed") return;
    const t = setTimeout(() => commit(advance(game)), REVEAL_MS);
    return () => clearTimeout(t);
  }, [game, commit]);

  // Questions answered here are questions answered: they feed the streak, the
  // rank and the leaderboard exactly like a normal round.
  const saved = useRef(false);
  useEffect(() => {
    if (game.phase !== "over" || saved.current || results.length === 0) return;
    saved.current = true;
    const score = results.filter((r) => r.correct).length * 100;
    void recordRound("trivia", results, score, user?.id).then(setOutcome);
  }, [game.phase, results, user?.id]);

  const restart = useCallback(() => {
    seen.current = new Set();
    saved.current = false;
    setResults([]); setOutcome(null); setItem(null); setChosen(null);
    setGame(newGame("x"));
  }, []);

  const names: Record<Mark, string> = { x: "You", o: "The bot" };

  return {
    game, item, options, chosen, results, outcome, names,
    loading: pool.length === 0,
    fraction: left / ASK_MS,
    myTurnToPick: game.phase === "picking" && game.turn === "x",
    iAnswer: game.phase === "asking" && game.answerer === "x",
    choose, submit, restart,
  };
}
