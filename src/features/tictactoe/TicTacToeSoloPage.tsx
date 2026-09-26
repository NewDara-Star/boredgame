import { useSearchParams } from "react-router-dom";
import { BoardSoloPage } from "@/features/play/BoardSoloPage";
import { Board } from "@/features/squareoff/Board";
import { gridBoard } from "@/features/squareoff/gridBoard";
import { TTT } from "@/features/squareoff/useTttRoom";
import { gridHero } from "@/features/squareoff/card";
import { parseWith, readWith } from "@/features/challenge/kinds";

const art = { hero: (g: { board: NonNullable<Parameters<typeof gridHero>[0]>; line: number[] | null }) => gridHero(g.board, g.line) };
const plainBoard = gridBoard(Board), tinted = gridBoard(Board, true);

/**
 * Tic Tac Toe against the bot, played with whatever a square costs ("Play it
 * with…", Daramola 26 Sep): nothing, a question, cup toss, hoops, knock-down or
 * a mix. Square Off and Catapult Squares were this with a setting; their old
 * links land here with it set.
 */
export function TicTacToeSoloPage() {
  const [q] = useSearchParams();
  const w = parseWith(q.get("with")) ?? readWith("tictactoe");
  return <BoardSoloPage key={w} engine={TTT} title="Tic Tac Toe" board={w === "none" ? plainBoard : tinted}
    glyphs={{ x: "cross", o: "ring" }} plain={w === "none"} challenge={w} art={art} />;
}
