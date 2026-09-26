import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/app/providers/AuthProvider";
import { loadContent, shuffle } from "@/features/play/content";
import { atLevels, readLevels, writeLevels, type Level } from "@/features/play/levels";
import { recordRound, type RoundOutcome } from "@/features/play/progress";
import { deal } from "@/features/play/dealer";
import { askMs } from "@/features/play/clock";
import { targetFor, botShot, isHit, flightMs, type Shot } from "@/features/challenge/rules";
import type { PlayItem, RoundResult } from "@/features/play/types";
import type { BoardEngine, BoardRow, BoardState, Mark } from "@/features/rooms/useBoardRoom";
// How often the bot gets a question right, by that question's difficulty. It
// lives in the Square Off rules because that is where it was written and a
// rules module may not import another one.
import { botIsRight } from "@/features/squareoff/rules";
import { nextMix, isShot, type Challenge, type TurnKind } from "@/features/challenge/kinds";
import { BOT_ODDS, type ShotLevel } from "@/features/challenge/shots";

const SHOT_LEVEL = "boredgame-shot-level-v1";
function readShotLevel(): ShotLevel { try { return localStorage.getItem(SHOT_LEVEL) === "easy" ? "easy" : "norm"; } catch { return "norm"; } }

const BOT_PICK_MS = 850;
const BOT_THINK_MS = 1500;
const BOT_COMMIT_MS = 750;
const REVEAL_MS = 2300;
/** A plain board has nothing to read, so the bot should not sit there. */
const PLAIN_BOT_MS = 550;

/**
 * One player, one bot, whichever board.
 *
 * The rooms already share `useBoardRoom`; this is the same idea for the solo
 * side, and it exists because the alternative was a fourth copy of a hook whose
 * third copy had a bug in it. Every transition goes through `commit`, which
 * deals a question at the moment the state becomes "asking" — dealing in a
 * separate effect leaves one render where the phase and the question disagree,
 * and the bot answers the previous question.
 */
export function useSoloBoard<G extends BoardState, R extends BoardRow>(
  engine: BoardEngine<G, R>,
  /** No questions: taking the square is the whole move. */
  plain = false,
  /** What the asking phase asks for: the session's choice ("Play it with…").
      Mix resolves to a different one each turn; `kind` below is this turn's. */
  challenge: Challenge | "catapult" = "trivia",
) {
  const mixing = challenge === "mix";
  const [turnKind, setTurnKind] = useState<TurnKind | "catapult">(() => (mixing ? nextMix(null) : challenge as TurnKind | "catapult"));
  /** what THIS turn costs */
  const kind = mixing ? turnKind : challenge as TurnKind | "catapult";
  const asksQuestions = challenge === "trivia" || mixing;
  const [shotLevel, setShotLevelState] = useState<ShotLevel>(readShotLevel);
  const setShotLevel = useCallback((l: ShotLevel) => {
    try { localStorage.setItem(SHOT_LEVEL, l); } catch { /* private mode */ }
    setShotLevelState(l);
  }, []);
  const { user } = useAuth();
  const [pool, setPool] = useState<PlayItem[]>([]);
  const [game, setGame] = useState<G>(() => engine.newGame("x"));
  const [item, setItem] = useState<PlayItem | null>(null);
  const [options, setOptions] = useState<string[]>([]);
  const [chosen, setChosen] = useState<string | null>(null);
  const [left, setLeft] = useState(askMs());
  const ask = askMs(item?.difficulty);
  const [results, setResults] = useState<RoundResult[]>([]);
  const [outcome, setOutcome] = useState<RoundOutcome | null>(null);
  // A session across games, the same as a room keeps. Playing the bot five
  // times and having each result vanish is what made solo feel like a lesser
  // mode than a room.
  const [wins, setWins] = useState({ x: 0, o: 0 });
  /** games finished this session, draws included: the X ends a session that
      has one (Daramola 26 Sep), and leaves one that hasn't */
  const [played, setPlayed] = useState(0);
  const [ended, setEnded] = useState(false);
  const counted = useRef(false);
  const seen = useRef<Set<string>>(new Set());
  /** What the bot has been shown this session. Only Memory fills this in; the
      board bots have nothing to remember. */
  const botSeen = useRef<Map<number, number>>(new Map());
  const askedAt = useRef(Date.now());

  // Held in a ref as well as state: `deal` runs inside event handlers and
  // timeouts, where reading it out of a setState updater would fire a side
  // effect twice under StrictMode.
  const poolRef = useRef<PlayItem[]>([]);
  /** every usable question; the pool is these at the chosen levels (talk item 9) */
  const everyRef = useRef<PlayItem[]>([]);
  const [levels, setLevelsState] = useState<Level[]>(readLevels);
  useEffect(() => {
    if (plain || !asksQuestions) return;
    void loadContent("trivia").then((all) => {
      everyRef.current = shuffle(all.filter((i) => i.choices && i.choices.length >= 2));
      const usable = atLevels(everyRef.current, readLevels());
      poolRef.current = usable;
      setPool(usable);
    });
  }, [plain, asksQuestions]);
  /** The next question comes from the new levels; the phone remembers them. */
  const setLevels = useCallback((next: Level[]) => {
    writeLevels(next);
    setLevelsState(next);
    if (everyRef.current.length) {
      const usable = atLevels(everyRef.current, next);
      poolRef.current = usable;
      setPool(usable);
    }
  }, []);

  // The catapult's target moves every turn but the physics never do, so getting
  // better at it is a real thing that happens — which is the whole point of it
  // as an alternative to a question.
  const [seed, setSeed] = useState(() => Date.now());
  const [botFires, setBotFires] = useState<Shot | null>(null);
  const level = "medium" as const;
  // Memoised on the seed, not rebuilt each render. targetFor returns a fresh
  // object, so an unmemoised target changed identity on every render, re-ran
  // the bot's effect, and its cleanup cancelled the timer that commits the
  // bot's shot — the same deadlock twice, once through state and once through
  // an object literal.
  const target = useMemo(() => targetFor(seed, level), [seed]);
  const newTarget = useCallback(() => {
    setSeed(Date.now());
    setBotFires(null);
  }, []);

  const lastServed = useRef<string | null>(null);
  const dealQuestion = useCallback(() => {
    // Not `?? pool[0]`: that fallback served one identical question for the
    // rest of a long session once everything had been seen.
    const { item: next } = deal(poolRef.current, (i) => i.id, seen.current,
      { avoid: lastServed.current });
    if (next) {
      lastServed.current = next.id;
      setItem(next);
      setOptions(shuffle(next.choices!));
    }
    setChosen(null);
    // The new question's own clock, not the previous one's — `next` is in hand
    // here, whereas `ask` above is a render behind at this moment.
    setLeft(askMs(next?.difficulty));
    askedAt.current = Date.now();
  }, []);

  /** The one door every state change goes through. */
  const commit = useCallback((next: G) => {
    if (next.phase === "asking" && game.phase !== "asking") {
      if (kind === "trivia") dealQuestion(); else newTarget();
    }
    // Mix: a new turn, a new challenge, known before the pick (the banner says it).
    if (mixing && next.phase === "picking" && game.phase !== "picking") setTurnKind((k) => nextMix(k as TurnKind));
    setGame(next);
  }, [game.phase, dealQuestion, kind, mixing, newTarget]);

  const choose = useCallback((cell: number) => {
    // No phase check here on purpose. Memory's second tap lands during
    // `asking`, and every reducer already refuses an illegal move by handing
    // back the state it was given — so the reducer is the authority and the
    // hook does not keep a second, staler copy of the rules.
    if (game.turn !== "x") return;
    if (!plain && kind === "trivia" && pool.length === 0) return;
    const next = plain ? engine.place(game, cell) : engine.pick(game, cell);
    if (next === game) return;                 // full column, taken square
    commit(next);
  }, [game, plain, pool.length, commit, engine, kind]);

  const submit = useCallback((opt: string | null) => {
    if (game.phase !== "asking" || engine.answerer(game) !== "x" || !item) return;
    setChosen(opt);
    setResults((r) => [...r, {
      item, correct: opt === item.answer, given: opt ?? "",
      msTaken: Date.now() - askedAt.current, hintsUsed: 0,
    }]);
    commit(engine.answer(game, opt === item.answer));
  }, [game, item, commit, engine]);

  /** A shot resolves exactly as an answer does — the board never learns which. */
  const fire = useCallback((hit: boolean) => {
    if (game.phase !== "asking" || engine.answerer(game) !== "x") return;
    commit(engine.answer(game, hit));
  }, [game, engine, commit]);

  // --- the bot ---------------------------------------------------------------
  useEffect(() => {
    // "asking" is the bot's second tap when the challenge is neither a question
    // nor a shot — Memory's turn is two taps, and without this the bot turned
    // one tile over and sat looking at it forever.
    const owed = game.phase === "picking"
      || (challenge === "none" && game.phase === "asking");
    if (!owed || game.turn !== "o") return;
    if (!plain && kind === "trivia" && pool.length === 0) return;
    const cell = engine.botCell(game, "o", Math.random, botSeen.current);
    const t = setTimeout(
      () => commit(plain ? engine.place(game, cell) : engine.pick(game, cell)),
      plain ? PLAIN_BOT_MS : BOT_PICK_MS);
    return () => clearTimeout(t);
  }, [game, commit, engine, plain, pool.length, challenge, kind]);

  /**
   * The bot's cup toss, basket or slingshot: it lands BOT_ODDS of them, so it
   * misses often enough to be beaten. Its throw isn't drawn; the banner says
   * what it's going for, then whether it got it.
   */
  useEffect(() => {
    if (!isShot(kind)) return;
    if (game.phase !== "asking" || engine.answerer(game) !== "o") return;
    const hit = Math.random() < BOT_ODDS[kind][shotLevel];
    const t = setTimeout(() => commit(engine.answer(game, hit)), 1500);
    return () => clearTimeout(t);
  }, [kind, shotLevel, game, engine, commit]);

  /**
   * Scheduled once per target, tracked in a ref rather than guarded on state.
   *
   * The first version guarded on `botFires` and listed it as a dependency, so
   * showing the bot's shot re-ran the effect and the cleanup cancelled the very
   * timer that was going to commit its answer. The bot picked a column, took
   * aim, and the game sat there forever.
   */
  const botAimed = useRef(-1);
  useEffect(() => {
    if (kind !== "catapult") return;
    if (game.phase !== "asking" || engine.answerer(game) !== "o") return;
    if (botAimed.current === seed) return;
    botAimed.current = seed;
    const shot = botShot(target, level, Math.random);
    // How long the shot takes depends on the shot: one that bounces and rolls
    // is on screen far longer than one that drops straight in, and a fixed
    // wait cut the bot's turn off with the ball still in the air.
    const t = setTimeout(() => setBotFires(shot), 420);
    const t2 = setTimeout(() => commit(engine.answer(game, isHit(shot, target))),
                          420 + flightMs(shot, target) + 260);
    return () => { clearTimeout(t); clearTimeout(t2); };
  }, [kind, game, engine, target, seed, commit]);

  useEffect(() => {
    if (kind !== "trivia") return;
    if (game.phase !== "asking" || engine.answerer(game) !== "o" || !item) return;
    // Decided up front so the option it highlights is the one it commits to —
    // watching it get one wrong is the point, not a hidden dice roll.
    const right = botIsRight(item.difficulty);
    const wrong = options.filter((o) => o !== item.answer);
    const choice = right || wrong.length === 0
      ? item.answer
      : wrong[Math.floor(Math.random() * wrong.length)];
    const t1 = setTimeout(() => setChosen(choice), BOT_THINK_MS);
    const t2 = setTimeout(() => commit(engine.answer(game, choice === item.answer)),
      BOT_THINK_MS + BOT_COMMIT_MS);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [kind, game, item, options, commit, engine]);

  // --- the clock, and moving on ----------------------------------------------
  useEffect(() => {
    // No clock on a shot: a countdown on an eight-year-old lining up a catapult
    // is the pressure this mode exists to remove.
    if (kind !== "trivia") return;
    if (game.phase !== "asking" || engine.answerer(game) !== "x") return;
    const id = setInterval(() => {
      const remaining = ask - (Date.now() - askedAt.current);
      setLeft(remaining);
      if (remaining <= 0) { clearInterval(id); submit(null); }
    }, 100);
    return () => clearInterval(id);
  }, [game, submit, ask, engine, kind]);

  useEffect(() => {
    if (game.phase !== "revealed") return;
    // A shot has "Just long." to read and nothing else; a question can have an
    // explanation. Neither wants the other's pause.
    const t = setTimeout(() => commit(engine.advance(game)),
      engine.revealMs ?? (kind === "trivia" ? REVEAL_MS : 1900));
    return () => clearTimeout(t);
  }, [game, commit, engine, kind]);

  // Everything the bot could have learned from, including the tiles the player
  // turned over — watching is how you get good at this game.
  useEffect(() => { engine.observe?.(game, botSeen.current); }, [game, engine]);

  useEffect(() => {
    if (game.phase !== "over" || counted.current) return;
    counted.current = true;
    setPlayed((n) => n + 1);
    if (game.winner === "x" || game.winner === "o") {
      const won = game.winner;
      setWins((w) => ({ ...w, [won]: w[won] + 1 }));
    }
  }, [game.phase, game.winner]);

  // Questions answered here are questions answered: they feed the streak, the
  // rank and the leaderboard exactly like a normal round. A plain game answers
  // none, but playing it still keeps the streak (talk item 1), so it's filed
  // too, with no answers in it.
  const saved = useRef(false);
  useEffect(() => {
    if (game.phase !== "over" || saved.current) return;
    saved.current = true;
    // Counted like any answers (totals, streak, rank), but no best score: a board
    // game isn't a Star Trivia round.
    void recordRound("trivia", results, null, user?.id).then(setOutcome);
  }, [game.phase, results, user?.id]);

  const restart = useCallback(() => {
    saved.current = false;
    counted.current = false;
    setResults([]); setOutcome(null); setItem(null); setChosen(null); setBotFires(null);
    botAimed.current = -1;
    // A rematch is a new deck, so what it saw last game is worth nothing.
    botSeen.current = new Map();
    // Loser starts the next one, the same rule a room uses. `seen` deliberately
    // survives, so a rematch does not re-ask the questions you just had.
    setGame((g) => engine.newGame(g.winner === "x" ? "o" : "x"));
    if (mixing) setTurnKind((k) => nextMix(k as TurnKind));
  }, [engine, mixing]);

  /** Ends the run of games and produces a result, exactly as Quit match does. */
  const endSession = useCallback(() => setEnded(true), []);

  const newSession = useCallback(() => {
    seen.current = new Set();
    saved.current = false;
    counted.current = false;
    setResults([]); setOutcome(null); setItem(null); setChosen(null);
    setWins({ x: 0, o: 0 }); setPlayed(0); setEnded(false);
    setBotFires(null); botAimed.current = -1;
    botSeen.current = new Map();
    setGame(engine.newGame("x"));
    if (mixing) setTurnKind((k) => nextMix(k as TurnKind));
  }, [engine, mixing]);

  const names: Record<Mark, string> = { x: "You", o: "The bot" };

  return {
    game, item, options, chosen, results, outcome, names, wins, played, ended,
    endSession, newSession,
    loading: !plain && asksQuestions && pool.length === 0,
    kind, shotLevel, setShotLevel,
    fraction: left / ask,
    myTurnToPick: game.phase === "picking" && game.turn === "x",
    /** Whose turn it is, without a view on which phases accept a tap — that
        rule belongs to the game, not to the page drawing it. */
    myTurn: game.turn === "x",
    iAnswer: game.phase === "asking" && engine.answerer(game) === "x",
    choose, submit, restart, fire,
    target, botFires, challenge,
    levels, setLevels,
  };
}
