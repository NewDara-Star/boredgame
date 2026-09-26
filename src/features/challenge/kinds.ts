/**
 * "Play it with…" (Daramola, 26 Sep): Tic Tac Toe and Connect 4 are the board
 * games, and what a spot costs is chosen before the game. Square Off, Catapult
 * Squares, Connect 4 Trivia and Connect 4 Catapult stopped being games of their
 * own; they were always one of these two with a setting.
 *
 * Chosen once per session. Mix deals a different one each turn, and the banner
 * says which before you pick. A miss leaves the spot open and passes the turn.
 */
import type { ShotKind, ShotLevel } from "./shots";

export type Challenge = "none" | "trivia" | ShotKind | "mix";
/** what one turn actually costs: Mix resolves to one of these */
export type TurnKind = Exclude<Challenge, "mix">;

export const CHALLENGES: { key: Challenge; name: string; says: string }[] = [
  { key: "none",   name: "None",       says: "The plain game: take the spot." },
  { key: "trivia", name: "Trivia",     says: "Every spot costs a right answer." },
  { key: "cup",    name: "Cup toss",   says: "Every spot costs a toss into the cup. Mind the wind." },
  { key: "hoops",  name: "Hoops",      says: "Every spot costs a basket. The hoop slides." },
  { key: "knock",  name: "Knock-down", says: "Every spot costs a slingshot: knock the gold off the stack." },
  { key: "mix",    name: "Mix",        says: "A different one every turn: a question, cup toss, hoops or knock-down." },
];
export const challengeName = (c: Challenge) => CHALLENGES.find((x) => x.key === c)?.name ?? "None";
export const isShot = (k: TurnKind | string): k is ShotKind => k === "cup" || k === "hoops" || k === "knock";

const MIX: TurnKind[] = ["trivia", "cup", "hoops", "knock"];
/** Mix's next turn: never the same one twice running. */
export function nextMix(prev: TurnKind | null, rand = Math.random): TurnKind {
  const pool = MIX.filter((k) => k !== prev);
  return pool[Math.floor(rand() * pool.length)];
}

export function parseWith(v: string | null | undefined): Challenge | null {
  return CHALLENGES.some((c) => c.key === v) ? (v as Challenge) : null;
}
const KEY = (slug: string) => `boredgame-with-v1:${slug}`;
/** The last choice for a game, remembered on this phone. */
export function readWith(slug: string): Challenge {
  try { return parseWith(localStorage.getItem(KEY(slug))) ?? "none"; } catch { return "none"; }
}
export function writeWith(slug: string, c: Challenge) {
  try { localStorage.setItem(KEY(slug), c); } catch { /* private mode */ }
}

/**
 * How a room plays it. A room stores a mode (which board, questions or not)
 * and a challenge; Tic Tac Toe with anything but None is the Square Off mode
 * (a spot costs something), Connect 4 likewise its trivia mode.
 */
export function roomSetup(slug: "tictactoe" | "connect4", c: Challenge): { mode: string; challenge: string } {
  if (c === "none") return { mode: slug, challenge: "trivia" };
  return { mode: slug === "tictactoe" ? "squareoff" : "connect4trivia", challenge: c };
}
/** And back: which "Play it with" a room's mode and challenge mean. The old
    catapult rooms play as a cup toss. */
export function roomWith(mode: string, challenge: string | null | undefined): Challenge {
  if (mode === "tictactoe" || mode === "connect4") return "none";
  if (challenge === "catapult") return "cup";
  return parseWith(challenge) ?? "trivia";
}

/* ------------------------------------------------------------- in a room */
type Mark = "x" | "o";
/** A shot in a room has 30 seconds (Daramola, 26 Sep). */
export const SHOT_MS = 30_000;

/**
 * What a room's board keeps for Play it with, in its `play` column: this
 * turn's challenge under Mix, and each player's shot level. The game picks the
 * level (Daramola, 26 Sep): everyone starts on Normal; two misses in a row move
 * you to Easy, two hits in a row move you back. `run` counts the streak: +2 is
 * two hits running, -2 two misses.
 */
export interface Play {
  kind?: TurnKind;
  lvl?: Partial<Record<Mark, ShotLevel>>;
  run?: Partial<Record<Mark, number>>;
}
export const levelOf = (p: Play | null | undefined, m: Mark): ShotLevel => p?.lvl?.[m] ?? "norm";

export function stepLevel(p: Play | null | undefined, m: Mark, hit: boolean): Play {
  const lvl = levelOf(p, m), was = p?.run?.[m] ?? 0;
  let run = hit ? (was > 0 ? was + 1 : 1) : (was < 0 ? was - 1 : -1);
  let next = lvl;
  if (lvl === "norm" && run <= -2) { next = "easy"; run = 0; }
  else if (lvl === "easy" && run >= 2) { next = "norm"; run = 0; }
  return { ...p, lvl: { ...p?.lvl, [m]: next }, run: { ...p?.run, [m]: run } };
}

/** Mix's first turn in a room, before anyone has written one: the same on both
    phones because it comes from the room, not from either phone's dice. */
export const mixStart = (roomId: number): TurnKind => MIX[Math.abs(roomId) % MIX.length];
/** This turn's challenge in a room. */
export function turnKindOf(c: Challenge, play: Play | null | undefined, roomId: number): TurnKind {
  if (c !== "mix") return c;
  return play?.kind ?? mixStart(roomId);
}
