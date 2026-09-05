import {
  newGame, pick, drop, answer, advance, botColumn, describe, type Game,
} from "./rules";
import { decode, encode, type C4Row } from "./wire";
import { useBoardRoom, startBoard, type BoardEngine, type Scope } from "@/features/rooms/useBoardRoom";

/**
 * Connect 4, plain and trivia. The difference from Square Off is the whole of
 * this file: a miss costs the turn and nothing else, so the pending answer is
 * always owed by whoever's turn it is — there is no steal to hand it away.
 */
export const C4: BoardEngine<Game, C4Row> = {
  table: "c4_games",
  channel: "c4",
  decode, encode, newGame, answer, advance,
  place: drop,
  pick,
  answerer: (g) => (g.phase === "asking" ? g.turn : null),
  botCell: (g, me, rand) => botColumn(g.board, me, rand),
  describe,
};

export function useC4Room(
  roomId: number | null, userId: string | undefined,
  scope: Scope | null = null, plain = false,
  challenge: "trivia" | "catapult" | "none" = "trivia",
) {
  return useBoardRoom(C4, roomId, userId, scope, plain, challenge);
}

export const startConnect4 = (roomId: number, xId: string, oId: string) =>
  startBoard(C4, roomId, xId, oId);
