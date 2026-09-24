import { motion } from "framer-motion";
import { MemoryFace } from "./Faces";
import { SPRING } from "@/shared/ui/motion";
import { COLS, FACES, faceUp, type Game } from "./rules";

/**
 * Sixteen tiles. A tile is face down, face up, or claimed — and a claimed one
 * keeps its face showing, because half the game is remembering where the pairs
 * you have already seen were.
 */
export function Board({ game, canFlip, width, onFlip }: {
  game: Game;
  canFlip: boolean;
  /** the width the screen can give it — see PlayBoard */
  width?: number;
  onFlip: (i: number) => void;
}) {
  const up = faceUp(game);
  const gap = width ? Math.max(3, width * 0.024) : 8;
  return (
    <div className={`grid mx-auto ${width ? "" : "w-full"}`}
      style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))`,
               gap, width, maxWidth: width ?? 340,
               fontSize: width ? Math.max(14, width * 0.09) : undefined }}>
      {game.deck.map((face, i) => {
        const owner = game.board[i];
        const shown = owner !== null || up.includes(i);
        const pair = game.line?.includes(i);
        return (
          <motion.button key={i}
            disabled={!canFlip || shown}
            onClick={() => onFlip(i)}
            animate={{ scale: pair ? 1.06 : 1 }}
            transition={SPRING}
            aria-label={shown ? `${FACES[face]}${owner ? ", claimed" : ""}` : `Tile ${i + 1}, face down`}
            className={`cut tap aspect-square grid place-items-center leading-none
              disabled:opacity-100 [--c:10px]
              ${owner === "x" ? "cut-petal" : owner === "o" ? "cut-sky"
                : shown ? "cut-board" : "cut-grape"}`}>
            <motion.span className="w-full h-full grid place-items-center"
              // The flip itself, rather than the face simply appearing: turning
              // a tile over is the entire verb of this game.
              initial={false}
              animate={{ rotateY: shown ? 0 : 180, opacity: shown ? 1 : 0 }}
              transition={{ duration: 0.22 }}>
              {shown ? <MemoryFace face={face} /> : ""}
            </motion.span>
          </motion.button>
        );
      })}
    </div>
  );
}
