/**
 * Ball Sort, as a race.
 *
 * Six tubes, five colours, four balls of each, one tube empty. Sort them until
 * every tube holds one colour. The rules are the physical ones: the top ball
 * of any tube may go onto any tube that has room. No "same colour only" — a
 * real set of tubes does not stop you parking a red on a blue to dig out the
 * green underneath, and that parking is half the plan.
 *
 * Played as a race rather than a solitaire: the same puzzle on two phones,
 * Dublin and Manchester, first to sort it wins. Under these rules every board
 * is solvable and there is no dead end (a move can always be taken back, so
 * the position graph is undirected), which makes it exactly a speed contest —
 * seeing the shortest route and executing it. That is the game.
 *
 * What a phone CANNOT do under these rules is solve a board: the state space
 * runs to millions of positions and A* takes seconds at the tail. So nothing
 * here solves anything. scripts/sort-bank.mts solved every board in advance
 * and wrote bank.ts — board, and the shortest line through it — and this file
 * only picks from it by seed. Difficulty is the length of that shortest line.
 *
 * Everything here is a pure function of its arguments, so the component draws
 * it, the bot plays it, both phones agree on the puzzle from one seed, the
 * edge function replays a finish with it, and scripts/check-sort.mts holds all
 * of that to account. bank.ts is its only import.
 */
import { BANK, type BankEntry } from "./bank.ts";

export type Level = "easy" | "medium" | "hard";

/** A tube, bottom first. Values are colour indices. */
export type Tube = number[];
/** one ball, from a tube to a tube */
export type Move = [from: number, to: number];

export interface Puzzle {
  tubes: Tube[];
  cap: number;
  colours: number;
  /** the fewest moves it can be solved in — A*'s answer, not a guess */
  par: number;
  /** one shortest line, for the bot. Not the only one: most boards have
      hundreds of equally short routes, so a player is not being asked to
      find THIS one. */
  line: Move[];
}

export interface Game {
  tubes: Tube[];
  cap: number;
  moves: number;
  history: { from: number; to: number }[];
}

export const CAP = 4;
export const COLOURS = 5;

const isUniform = (t: Tube) => t.every((c) => c === t[0]);

/** Why a move is refused, or null when it is fine. The UI says so — a tube
    that will not take a ball should visibly refuse, not silently re-select. */
export function whyNot(tubes: Tube[], cap: number, from: number, to: number):
  "same" | "empty" | "full" | "range" | null {
  const a = tubes[from], b = tubes[to];
  if (!a || !b) return "range";
  if (from === to) return "same";
  if (a.length === 0) return "empty";
  if (b.length >= cap) return "full";
  return null;
}
export const canPour = (tubes: Tube[], cap: number, from: number, to: number) =>
  whyNot(tubes, cap, from, to) === null;

/** One ball, poured. Returns the same game when the move is illegal, so a
    caller can test by identity and a stray tap changes nothing. */
export function pour(g: Game, from: number, to: number): Game {
  if (!canPour(g.tubes, g.cap, from, to)) return g;
  const tubes = g.tubes.map((t) => t.slice());
  tubes[to].push(tubes[from].pop()!);
  return { ...g, tubes, moves: g.moves + 1, history: [...g.history, { from, to }] };
}

/** Take the last move back. Undo is not free in a race — it still cost a move. */
export function undo(g: Game): Game {
  const last = g.history[g.history.length - 1];
  if (!last) return g;
  const tubes = g.tubes.map((t) => t.slice());
  tubes[last.from].push(tubes[last.to].pop()!);
  return { ...g, tubes, history: g.history.slice(0, -1) };
}

export const isSolved = (tubes: Tube[], cap: number) =>
  tubes.every((t) => t.length === 0 || (t.length === cap && isUniform(t)));

/** Tubes already finished — a colour fully home. */
export const solvedCount = (tubes: Tube[], cap: number) =>
  tubes.filter((t) => t.length === cap && isUniform(t)).length;

/**
 * The wire format: one character per ball, "/" between tubes, so
 * "0123/1032/2301/3210/2013/" is five filled tubes and one empty.
 *
 * It lives here rather than in a wire module because the SERVER parses it too
 * — sort_is_solved reads it in SQL, and the edge function that verifies a
 * finish runs this very file. One definition, three runtimes. bank.ts stores
 * boards in this form as well.
 */
export const encodeTubes = (tubes: Tube[]) => tubes.map((t) => t.join("")).join("/");
export const decodeTubes = (s: string): Tube[] =>
  s.split("/").map((t) => [...t].map((c) => Number(c)));

/** A bank line is two digits per move, "05" being tube 0 to tube 5. */
export const decodeLine = (s: string): Move[] => {
  const out: Move[] = [];
  for (let i = 0; i + 1 < s.length; i += 2) out.push([Number(s[i]), Number(s[i + 1])]);
  return out;
};

export const newGame = (p: Puzzle): Game =>
  ({ tubes: p.tubes.map((t) => t.slice()), cap: p.cap, moves: 0, history: [] });

/**
 * A stream of numbers from one seed. Both phones derive the puzzle from the
 * moment the race was written — the row they already share — so they get the
 * same board without another column. Same hash as the catapult's, for the
 * same reason: seeds are timestamps whose low bits move in lockstep.
 */
export function stream(seed: number): () => number {
  let h = Math.abs(Math.trunc(seed)) || 1;
  h = (h ^ 61) ^ (h >>> 16);
  h = h + (h << 3);
  h = h ^ (h >>> 4);
  h = Math.imul(h, 0x27d4eb2d);
  h = h ^ (h >>> 15);
  let s = h >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

export const fromBank = (e: BankEntry): Puzzle => {
  const line = decodeLine(e[1]);
  return { tubes: decodeTubes(e[0]), cap: CAP, colours: COLOURS, par: line.length, line };
};

/**
 * The puzzle for a seed: one draw from the level's shelf of the bank. The
 * bank is finite, so over enough races a board comes round again; the shelves
 * are large enough that two people racing weekly will not notice for years.
 */
export function puzzleFor(seed: number, level: Level = "medium"): Puzzle {
  const shelf = BANK[level];
  return fromBank(shelf[Math.floor(stream(seed)() * shelf.length)]);
}

/**
 * The bot.
 *
 * It cannot solve the board any more than the phone can, so it plays the
 * stored shortest line — and is made beatable not by playing worse moves but
 * by HESITATING: with probability 1 − skill it makes a move that is not on
 * the line, sees it, and takes it back, which costs it two moves and two
 * beats of its clock. That is what a person who lost the thread does, and it
 * shows on the other phone as a ball going out and coming home.
 */
export const BOT_SKILL: Record<Level, number> = { easy: 0.75, medium: 0.85, hard: 0.93 };
/** Milliseconds between the bot's moves — its thinking time, before jitter. */
export const BOT_PACE: Record<Level, number> = { easy: 1900, medium: 1500, hard: 1100 };

export interface BotState {
  /** how far along the line it is */
  step: number;
  /** the move it is currently regretting, to be taken back next */
  regret: Move | null;
}
export const botStart = (): BotState => ({ step: 0, regret: null });

export function botMove(g: Game, line: Move[], st: BotState, level: Level, rand: () => number):
  { move: Move; st: BotState } | null {
  if (st.regret) return { move: [st.regret[1], st.regret[0]], st: { ...st, regret: null } };
  const planned = line[st.step];
  if (!planned) return null;
  if (rand() >= BOT_SKILL[level]) {
    const wrong: Move[] = [];
    for (let f = 0; f < g.tubes.length; f++) for (let t = 0; t < g.tubes.length; t++) {
      if (f === planned[0] && t === planned[1]) continue;
      if (g.tubes[f].length === g.cap && isUniform(g.tubes[f])) continue; // it would not touch a finished tube
      if (canPour(g.tubes, g.cap, f, t)) wrong.push([f, t]);
    }
    if (wrong.length) {
      const move = wrong[Math.floor(rand() * wrong.length)];
      return { move, st: { ...st, regret: move } };
    }
  }
  return { move: planned, st: { ...st, step: st.step + 1 } };
}

/** The bot's next thinking time: its pace, ±40%, so it does not tick like a clock. */
export const botDelay = (level: Level, rand: () => number) =>
  Math.round(BOT_PACE[level] * (0.6 + rand() * 0.8));
