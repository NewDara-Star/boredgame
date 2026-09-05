import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BOT_PACE, botPour, isSolved, newGame, pour, puzzleFor, solvedCount, undo,
  type Game, type Level,
} from "./rules";

export type Racer = "me" | "bot";

/**
 * A race against the bot: the same puzzle on two boards, first to sort it.
 *
 * Your board and the bot's are independent games from one puzzle. The bot
 * pours on its own clock and never touches yours; the race ends the instant
 * either board is sorted. Both keep counting moves, because "solved in 14, par
 * 11" is the sentence the game exists to say.
 */
export function useSortRace(level: Level = "medium") {
  const [seed, setSeed] = useState(() => Date.now());
  const puzzle = useMemo(() => puzzleFor(seed, level), [seed, level]);

  const [me, setMe] = useState<Game>(() => newGame(puzzle));
  const [bot, setBot] = useState<Game>(() => newGame(puzzle));
  const [selected, setSelected] = useState<number | null>(null);
  const [winner, setWinner] = useState<Racer | null>(null);
  const [startedAt, setStartedAt] = useState<number>(() => Date.now());
  const [finishedAt, setFinishedAt] = useState<number | null>(null);
  const [wins, setWins] = useState({ me: 0, bot: 0 });
  const [ended, setEnded] = useState(false);

  // a fresh puzzle resets both boards; the tally survives it
  useEffect(() => {
    setMe(newGame(puzzle)); setBot(newGame(puzzle));
    setSelected(null); setWinner(null);
    setStartedAt(Date.now()); setFinishedAt(null);
  }, [puzzle]);

  const finish = useCallback((who: Racer) => {
    setWinner((w) => {
      if (w) return w;                          // first past the post, once
      setFinishedAt(Date.now());
      setWins((t) => ({ ...t, [who]: t[who] + 1 }));
      return who;
    });
  }, []);

  /** Tap a tube. First tap lifts its top run; the second pours it, or — if
      that pour is illegal — lifts the new tube instead, which is what a thumb
      that changed its mind meant. */
  const pick = useCallback((i: number) => {
    if (winner) return;
    setMe((g) => {
      if (selected === null) {
        if (g.tubes[i].length > 0) setSelected(i);
        return g;
      }
      if (selected === i) { setSelected(null); return g; }
      const next = pour(g, selected, i);
      if (next === g) { setSelected(g.tubes[i].length > 0 ? i : null); return g; }
      setSelected(null);
      if (isSolved(next.tubes, next.cap)) finish("me");
      return next;
    });
  }, [selected, winner, finish]);

  const takeBack = useCallback(() => {
    if (winner) return;
    setSelected(null);
    setMe((g) => undo(g));
  }, [winner]);

  // The bot, on its own clock. Its next pour is decided at the moment it pours,
  // from the board as it is then — it never plans against a board you changed.
  const botRand = useRef(Math.random);
  useEffect(() => {
    if (winner) return;
    const t = setInterval(() => {
      setBot((g) => {
        if (isSolved(g.tubes, g.cap)) return g;
        const mv = botPour(g, level, botRand.current);
        if (!mv) return g;
        const next = pour(g, mv[0], mv[1]);
        if (isSolved(next.tubes, next.cap)) finish("bot");
        return next;
      });
    }, BOT_PACE[level]);
    return () => clearInterval(t);
  }, [level, winner, finish, puzzle]);

  const restart = useCallback(() => setSeed(Date.now()), []);
  const endSession = useCallback(() => setEnded(true), []);
  const newSession = useCallback(() => {
    setWins({ me: 0, bot: 0 }); setEnded(false); setSeed(Date.now());
  }, []);

  return {
    puzzle, me, bot, selected, winner, wins, ended,
    startedAt, finishedAt,
    progress: { me: solvedCount(me.tubes, me.cap), bot: solvedCount(bot.tubes, bot.cap) },
    pick, takeBack, restart, endSession, newSession,
  };
}
