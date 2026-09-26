import { useSearchParams } from "react-router-dom";
import { parseWith, readWith } from "@/features/challenge/kinds";
import { BoardSoloPage, BOARD_RATIO } from "@/features/play/BoardSoloPage";
import { gridBoard } from "@/features/squareoff/gridBoard";
import { Board } from "./Board";
import { C4 } from "./useC4Room";
import { c4Hero } from "./card";

const board = gridBoard(Board);
const glyphs = { x: "disc", o: "disc" } as const;
const art = () => ({ hero: (g: { board: NonNullable<Parameters<typeof c4Hero>[0]>; line: number[] | null }) => c4Hero(g.board, g.line) });

/**
 * Connect 4 against the bot, played with whatever a column costs ("Play it
 * with…", Daramola 26 Sep). Connect 4 Trivia and Connect 4 Catapult were this
 * with a setting; their old links land here with it set.
 */
export function Connect4SoloPage() {
  const [q] = useSearchParams();
  const w = parseWith(q.get("with")) ?? readWith("connect4");
  return <BoardSoloPage key={w} engine={C4} title="Connect 4" board={board} glyphs={glyphs}
    plain={w === "none"} challenge={w} ratio={BOARD_RATIO.connect4} art={art()} />;
}
