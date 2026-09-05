/**
 * Ball Sort, as a race.
 *
 * Six tubes, five colours, four balls of each, one tube empty. Sort them until
 * every tube holds one colour. The rules are the physical ones: the top ball
 * of any tube may go onto any tube that has room. No "same colour only" — a
 * real set of tubes does not stop you parking a red on a blue to dig out the
 * green underneath, and that parking is half the plan.
 *
 * Played against the clock, not a bot. Solo is today's board — one per level
 * per day, everyone on the same one, ranked by time; in a room it is the same
 * board on two phones, first to sort it wins. Under these rules every board
 * is solvable and there is no dead end (a move can always be taken back, so
 * the position graph is undirected), which makes it exactly a speed contest —
 * seeing the shortest route and executing it. That is the game, and the reason
 * there is no bot: a bot in a race against time is furniture.
 *
 * What a phone CANNOT do under these rules is solve a board: the state space
 * runs to millions of positions and A* takes seconds at the tail. So nothing
 * here solves anything. scripts/sort-bank.mts solved every board in advance
 * and wrote bank.ts — board, and the shortest line through it — and this file
 * only picks from it by seed. Difficulty is the length of that shortest line.
 *
 * Everything here is a pure function of its arguments, so the component draws
 * it, both phones agree on the puzzle from one seed, the edge function replays
 * a finish with it, and scripts/check-sort.mts holds all of that to account.
 * bank.ts is its only import.
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
  /** one shortest line — the proof behind `par`, replayed by check-sort. Not
      the only one: most boards have hundreds of equally short routes. */
  line: Move[];
}

/** one ball's journey, and when it happened — milliseconds since the first lift */
export interface LogMove { from: number; to: number; at: number }

export interface Game {
  tubes: Tube[];
  cap: number;
  moves: number;
  /** the moves that stand — what undo takes from, and what the referee replays */
  history: { from: number; to: number }[];
  /** every ball that moved, take-backs included, in order and in time: the
      replay. A take-back is a ball going home, and the film shows it. */
  log: LogMove[];
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
export function pour(g: Game, from: number, to: number, at = 0): Game {
  if (!canPour(g.tubes, g.cap, from, to)) return g;
  const tubes = g.tubes.map((t) => t.slice());
  tubes[to].push(tubes[from].pop()!);
  return {
    ...g, tubes, moves: g.moves + 1,
    history: [...g.history, { from, to }],
    log: [...g.log, { from, to, at }],
  };
}

/** Take the last move back. Undo is not free in a race — it still cost a move. */
export function undo(g: Game, at = 0): Game {
  const last = g.history[g.history.length - 1];
  if (!last) return g;
  const tubes = g.tubes.map((t) => t.slice());
  tubes[last.from].push(tubes[last.to].pop()!);
  return {
    ...g, tubes,
    history: g.history.slice(0, -1),
    log: [...g.log, { from: last.to, to: last.from, at }],
  };
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
  ({ tubes: p.tubes.map((t) => t.slice()), cap: p.cap, moves: 0, history: [], log: [] });

/**
 * The replay on the wire: "05@1200,12@1850" — from, to, and milliseconds since
 * the first lift, one entry per ball that moved. Stored on the attempt so a
 * time on the ladder can be watched, not just read.
 */
export const encodeLog = (log: LogMove[]) => log.map((m) => `${m.from}${m.to}@${m.at}`).join(",");
export const decodeLog = (s: string): LogMove[] =>
  s ? s.split(",").map((e) => ({ from: Number(e[0]), to: Number(e[1]), at: Number(e.slice(3)) })) : [];

/** A log is only a replay if it is a legal line that finishes the board, in
    order in time. The referee checks this before storing one. */
export function logSolves(p: Puzzle, log: LogMove[]): boolean {
  let g = newGame(p), last = -1;
  for (const m of log) {
    if (!Number.isFinite(m.at) || m.at < last) return false;
    last = m.at;
    const next = pour(g, m.from, m.to, m.at);
    if (next === g) return false;
    g = next;
  }
  return isSolved(g.tubes, g.cap);
}

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
 * Today's tubes: one board per level per day, the same for everyone, so a
 * time on it means something next to somebody else's. The day is the
 * player's own calendar day, as it is for streaks (see play/streak.ts); the
 * server accepts a day within one of its own. Hashed from the text so that
 * consecutive days are unrelated draws rather than neighbours in the bank.
 */
export function dailySeed(day: string, level: Level): number {
  let h = 2166136261;
  for (const ch of `${day}:${level}`) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export const dailyPuzzle = (day: string, level: Level) => puzzleFor(dailySeed(day, level), level);

/**
 * A solve, watched back.
 *
 * The log is every ball that moved and when. Played at its own pace a long
 * solve is a long film, so playback is scaled to fit FIT_MS and then holds
 * the sorted board for a beat; the clock in the frame shows RUN time, not
 * playback time, so what it counts to is the time on the ladder. Each ball
 * is in the air for FLIGHT_MS of playback, landing at the moment its tap
 * happened. Pure functions of (replay, playback time), so the on-screen
 * player and the GIF encoder draw exactly the same frames.
 */
export interface Replay {
  tubes: Tube[];
  cap: number;
  log: LogMove[];
  /** the time that counts — the server's, or the phone's in practice */
  ms: number;
  moves: number;
  par: number;
  name: string;
  level: Level;
  /** the footer's first line: "TODAY'S TUBES" or "PRACTICE" */
  where: string;
  rank?: number | null;
}

/** One ball in the air, between two tubes: which colour, where from, where
    to, and how far along (0 lifted, 1 landed). */
export interface Flight { colour: number; from: number; to: number; k: number }

export const FIT_MS = 13_000;
export const HOLD_MS = 2_000;
export const FLIGHT_MS = 240;

/** how much faster than life the film runs — never slower */
export const speedOf = (r: Replay) => Math.max(1, r.ms / FIT_MS);
/** the film's length in playback milliseconds */
export const durationOf = (r: Replay) => r.ms / speedOf(r) + HOLD_MS;

export interface Frame { tubes: Tube[]; flight: Flight | null; runMs: number; done: boolean }

/** The board at playback time `t`: moves landed so far applied, the one in
    the air (if any) lifted out of its tube, and the run clock. */
export function frameAt(r: Replay, t: number): Frame {
  const speed = speedOf(r);
  const tubes = r.tubes.map((x) => x.slice());
  let flight: Flight | null = null;
  for (const m of r.log) {
    const lands = m.at / speed;
    if (lands <= t) { tubes[m.to].push(tubes[m.from].pop()!); continue; }
    if (lands - FLIGHT_MS < t) {
      const colour = tubes[m.from].pop()!;
      flight = { colour, from: m.from, to: m.to, k: (t - (lands - FLIGHT_MS)) / FLIGHT_MS };
    }
    break;
  }
  const runMs = Math.min(r.ms, Math.max(0, t * speed));
  return { tubes, flight, runMs, done: t * speed >= r.ms };
}

/** 0:41.2 — tenths, because a time attack is decided in them. */
export const clock = (ms: number, tenths = true) => {
  const s = Math.floor(ms / 1000);
  const t = tenths ? `.${Math.floor((ms % 1000) / 100)}` : "";
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}${t}`;
};
