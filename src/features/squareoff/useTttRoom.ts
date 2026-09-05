import { newGame, pick, place, answer, advance, type Game } from "./rules";
import { decode, encode, type TttRow } from "./wire";
import { useBoardRoom, startBoard, type BoardEngine, type Scope } from "@/features/rooms/useBoardRoom";

/**
 * Square Off and plain Tic Tac Toe: same board, same table, same reducer, with
 * the questions switched off for the plain one.
 *
 * Everything that is not specific to this board — the subscription, the
 * optimistic write, booking the win, quitting, reopening, starting — lives in
 * useBoardRoom. What is left here is the difference: the answer can be owed by
 * the player who did NOT pick, because a miss gives the opponent one shot at
 * the square.
 */
export const TTT: BoardEngine<Game, TttRow> = {
  table: "ttt_games",
  channel: "ttt",
  decode, encode, newGame, place, pick, answer, advance,
  answerer: (g) => g.answerer,
};

export function useTttRoom(
  roomId: number | null, userId: string | undefined,
  scope: Scope | null = null, plain = false,
) {
  return useBoardRoom(TTT, roomId, userId, scope, plain);
}

export const startSquareOff = (roomId: number, xId: string, oId: string) =>
  startBoard(TTT, roomId, xId, oId);
