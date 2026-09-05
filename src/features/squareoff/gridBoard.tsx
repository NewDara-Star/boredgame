import { Board } from "./Board";
import type { DrawBoard } from "@/features/play/BoardSoloPage";

/**
 * The grid boards — Square Off's 3x3 and Connect 4's 7x6 — take identical
 * props, so one adapter draws either. A tap is only offered while picking: the
 * asking phase belongs to the question or the shot, and a board that still
 * looks tappable there invites a tap that does nothing.
 */
export const gridBoard =
  <G extends { board: (("x" | "o") | null)[]; target: number | null; line: number[] | null; phase: string }>(
    Grid: typeof Board,
  ): DrawBoard<G> =>
    ({ game, myTurn, width, onPick }) => (
      <Grid board={game.board} target={game.target} line={game.line}
        canPick={myTurn && game.phase === "picking"}
        compact={game.phase === "asking" || game.phase === "revealed"}
        width={width}
        onPick={onPick} />
    );
