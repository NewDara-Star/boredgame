import { motion } from "framer-motion";
import { SPRING } from "@/shared/ui/motion";
import { COLS, FACES, faceUp, type Game } from "./rules";

/**
 * Sixteen tiles. A tile is face down, face up, or claimed — and a claimed one
 * keeps its face showing, because half the game is remembering where the pairs
 * you have already seen were.
 */
export function Board({ game, canFlip, onFlip }: {
  game: Game;
  canFlip: boolean;
  onFlip: (i: number) => void;
}) {
  const up = faceUp(game);
  return (
    <div className="grid gap-2 mx-auto w-full max-w-[340px]"
      style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}>
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
            className={`piece press aspect-square grid place-items-center text-[30px] leading-none
              disabled:opacity-100
              ${owner === "x" ? "bg-picto/25" : owner === "o" ? "bg-trivia/25"
                : shown ? "bg-pop" : "bg-surface"}`}>
            <motion.span
              // The flip itself, rather than the face simply appearing: turning
              // a tile over is the entire verb of this game.
              initial={false}
              animate={{ rotateY: shown ? 0 : 180, opacity: shown ? 1 : 0 }}
              transition={{ duration: 0.22 }}>
              {shown ? FACES[face] : ""}
            </motion.span>
          </motion.button>
        );
      })}
    </div>
  );
}
