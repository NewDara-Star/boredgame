import { motion } from "framer-motion";
import { SPRING } from "@/shared/ui/motion";
import type { Cell, Mark } from "./rules";

const COLOUR: Record<Mark, string> = { x: "var(--color-picto)", o: "var(--color-trivia)" };

/** Drawn, not typed. A letter X and the letter O sit at different optical weights. */
function Glyph({ mark }: { mark: Mark }) {
  const common = {
    fill: "none", stroke: COLOUR[mark], strokeWidth: 11,
    strokeLinecap: "round" as const,
  };
  return (
    <motion.svg viewBox="0 0 100 100" className="w-[62%] h-[62%]"
      initial={{ scale: 0.3, rotate: mark === "x" ? -30 : 30, opacity: 0 }}
      animate={{ scale: 1, rotate: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 15 }}>
      {mark === "x"
        ? <><path d="M22 22 L78 78" {...common} /><path d="M78 22 L22 78" {...common} /></>
        : <circle cx="50" cy="50" r="29" {...common} />}
    </motion.svg>
  );
}

export function Board({
  board, target, line, canPick, compact = false, onPick,
}: {
  board: Cell[]; target: number | null; line: number[] | null;
  canPick: boolean; compact?: boolean; onPick: (i: number) => void;
}) {
  return (
    // The board shrinks while a question is up. At full size the options sit
    // below the fold, and you cannot judge whether a square is worth fighting
    // for without seeing the board it belongs to.
    <motion.div
      className="grid grid-cols-3 mx-auto"
      animate={{ maxWidth: compact ? 188 : 336, gap: compact ? 6 : 10 }}
      transition={SPRING}>
      {board.map((cell, i) => {
        const contested = target === i;
        const won = line?.includes(i);
        const open = cell === null;
        const pickable = canPick && open;
        return (
          <motion.button
            key={i}
            disabled={!pickable}
            onClick={() => pickable && onPick(i)}
            aria-label={cell ? `Square ${i + 1}, taken` : `Square ${i + 1}, open`}
            className={`piece ${pickable ? "press" : ""} aspect-square grid place-items-center
              ${compact ? "rounded-[14px]" : ""}
              ${won ? "bg-good" : contested ? "bg-pop" : "bg-surface"}
              ${pickable ? "cursor-pointer" : "cursor-default"}`}
            style={{ opacity: 1 }}
            animate={won ? { scale: [1, 1.1, 1] } : contested ? { scale: [1, 1.04, 1] } : { scale: 1 }}
            transition={won ? { ...SPRING, delay: (line?.indexOf(i) ?? 0) * 0.09 }
              : contested ? { duration: 1.1, repeat: Infinity, ease: "easeInOut" } : SPRING}>
            {cell
              ? <Glyph mark={cell} />
              : pickable
                // A number, not a dot: "square 5" in the running commentary has
                // to point at something you can actually see.
                ? <span className={`font-display font-semibold text-soft/35 tabular-nums
                    ${compact ? "text-base" : "text-2xl"}`}>{i + 1}</span>
                : <span className={`font-display font-semibold text-soft/15 tabular-nums
                    ${compact ? "text-base" : "text-2xl"}`}>{i + 1}</span>}
          </motion.button>
        );
      })}
    </motion.div>
  );
}
