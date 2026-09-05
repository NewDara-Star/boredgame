import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  botDelay, botMove, botStart, isSolved, newGame, pour, puzzleFor, solvedCount, undo, whyNot,
  type BotState, type Game, type Level,
} from "./rules";

export type Racer = "me" | "bot";
export interface Refusal { tube: number; at: number }

/**
 * A race against the bot: the same puzzle on two boards, first to sort it.
 *
 * Your board and the bot's are independent games from one puzzle. The bot
 * moves on its own clock and never touches yours; the race ends the instant
 * either board is sorted. Both keep counting moves, because "solved in 24, par
 * 20" is the sentence the game exists to say.
 */
export function useSortRace(level: Level = "medium") {
  const [seed, setSeed] = useState(() => Date.now());
  const puzzle = useMemo(() => puzzleFor(seed, level), [seed, level]);

  const [me, setMe] = useState<Game>(() => newGame(puzzle));
  const [bot, setBot] = useState<Game>(() => newGame(puzzle));
  const [selected, setSelected] = useState<number | null>(null);
  const [refused, setRefused] = useState<Refusal | null>(null);
  const [winner, setWinner] = useState<Racer | null>(null);
  const [startedAt, setStartedAt] = useState<number>(() => Date.now());
  const [finishedAt, setFinishedAt] = useState<number | null>(null);
  const [wins, setWins] = useState({ me: 0, bot: 0 });
  const [ended, setEnded] = useState(false);

  // a fresh puzzle resets both boards; the tally survives it
  useEffect(() => {
    setMe(newGame(puzzle)); setBot(newGame(puzzle));
    setSelected(null); setRefused(null); setWinner(null);
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

  /** Tap a tube. The first tap lifts its top ball; the second drops it there.
      A tube that cannot take it — only ever a full one — refuses visibly and
      the ball stays lifted, because a silent re-select reads as a broken tap. */
  const pick = useCallback((i: number) => {
    if (winner) return;
    setMe((g) => {
      if (selected === null) {
        if (g.tubes[i].length > 0) setSelected(i);
        return g;
      }
      if (selected === i) { setSelected(null); return g; }
      if (whyNot(g.tubes, g.cap, selected, i)) { setRefused({ tube: i, at: Date.now() }); return g; }
      const next = pour(g, selected, i);
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

  // The bot, on its own clock: the stored line, with hesitations. Each move
  // schedules the next, at a jittered pace, so it does not tick like a clock.
  const botRand = useRef(Math.random);
  const botState = useRef<BotState>(botStart());
  useEffect(() => { botState.current = botStart(); }, [puzzle]);
  useEffect(() => {
    if (winner) return;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      setBot((g) => {
        if (isSolved(g.tubes, g.cap)) return g;
        const r = botMove(g, puzzle.line, botState.current, level, botRand.current);
        if (!r) return g;
        botState.current = r.st;
        const next = pour(g, r.move[0], r.move[1]);
        if (isSolved(next.tubes, next.cap)) finish("bot");
        return next;
      });
      timer = setTimeout(tick, botDelay(level, botRand.current));
    };
    timer = setTimeout(tick, botDelay(level, botRand.current));
    return () => clearTimeout(timer);
  }, [level, winner, finish, puzzle]);

  const restart = useCallback(() => setSeed(Date.now()), []);
  const endSession = useCallback(() => setEnded(true), []);
  const newSession = useCallback(() => {
    setWins({ me: 0, bot: 0 }); setEnded(false); setSeed(Date.now());
  }, []);

  return {
    puzzle, me, bot, selected, refused, winner, wins, ended,
    startedAt, finishedAt,
    progress: { me: solvedCount(me.tubes, me.cap), bot: solvedCount(bot.tubes, bot.cap) },
    pick, takeBack, restart, endSession, newSession,
  };
}
