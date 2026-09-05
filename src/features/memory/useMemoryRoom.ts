import {
  newGame, flip, advance, answer, botFlip, remember, describe, faceUp,
  type Game,
} from "./rules";
import { decode, encode, type MemoryRow } from "./wire";
import {
  useBoardRoom, startBoard, type BoardEngine, type Scope,
} from "@/features/rooms/useBoardRoom";

/**
 * Memory, on the same synced row as every other board.
 *
 * Both taps of a turn go through `flip`: the first opens a pair, the second
 * closes it. That is why `place` and `pick` are the same function — the reducer
 * knows which tap it is holding and the hook does not have to.
 *
 * `answer` is never called. A memory turn resolves on the second tap, not on
 * anything anyone answers, and the engine says so by handing back the state it
 * was given.
 */
export const MEMORY: BoardEngine<Game, MemoryRow> = {
  table: "memory_games",
  channel: "mem",
  decode, encode,
  newGame: (first) => newGame(first),
  place: flip,
  pick: flip,
  answer,
  advance,
  answerer: (g) => (g.phase === "asking" ? g.turn : null),
  botCell: (g, _me, rand, seen) => botFlip(g, seen ?? new Map(), rand),
  describe,
  // Both players watch both tiles turn over — that IS the game, so the bot
  // learns from your turns as well as its own.
  observe: (g, seen) => {
    for (const i of faceUp(g)) remember(seen, i, g.deck[i]);
  },
};

export function useMemoryRoom(
  roomId: number | null, userId: string | undefined, scope: Scope | null = null,
) {
  // "none": the asking phase here needs no question and no target, only a
  // second tap, so nothing is fetched and nothing is dealt.
  return useBoardRoom(MEMORY, roomId, userId, scope, false, "none");
}

export const startMemory = (roomId: number, xId: string, oId: string) =>
  startBoard(MEMORY, roomId, xId, oId);
