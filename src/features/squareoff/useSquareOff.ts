import { useSoloBoard } from "@/features/play/useSoloBoard";
import { TTT } from "./useTttRoom";

export { ASK_MS, askMs } from "@/features/play/clock";

/**
 * Solo Square Off. Nothing left here but the engine it plays on: the bot, the
 * clock, the session tally and recording the round are all in useSoloBoard,
 * shared with plain Tic Tac Toe and both Connect 4s.
 *
 * It was the original and the other three were written against it by hand,
 * which is how Connect 4 ended up with a dealing bug the copy inherited and the
 * original did not. Kept as a named function so SquareOffPage reads the same.
 */
export function useSquareOff() {
  return useSoloBoard(TTT);
}
