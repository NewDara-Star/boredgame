/**
 * "Play it with…" (Daramola, 26 Sep): Tic Tac Toe and Connect 4 are the board
 * games, and what a spot costs is chosen before the game. Square Off, Catapult
 * Squares, Connect 4 Trivia and Connect 4 Catapult stopped being games of their
 * own; they were always one of these two with a setting.
 *
 * Chosen once per session. Mix deals a different one each turn, and the banner
 * says which before you pick. A miss leaves the spot open and passes the turn.
 */
import type { ShotKind } from "./shots";

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

/** How a room plays it, until rooms carry the new challenges (slice 2). */
export function roomPreset(slug: "tictactoe" | "connect4", c: Challenge): string | null {
  if (c === "none") return slug;
  if (c === "trivia") return slug === "tictactoe" ? "squareoff" : "connect4trivia";
  return null;
}
