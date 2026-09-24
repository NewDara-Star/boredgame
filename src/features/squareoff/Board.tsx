import { motion } from "framer-motion";
import { SPRING } from "@/shared/ui/motion";
import type { Cell, Mark } from "./rules";
import { SEAT_CSS } from "@/shared/brand/seats";
import { SOLO_OWNERS, whose, type Owners } from "@/features/play/board";

/** Drawn, not typed, and outlined: a piece is a subject (BRAND.md rule 1). The ink
    stroke underneath is the outline; the seat colour sits on top with a glint. */
function Glyph({ mark }: { mark: Mark }) {
  const line = { fill: "none", strokeLinecap: "round" as const };
  const shape = (stroke: string, w: number, dy = 0) => mark === "x"
    ? <g transform={`translate(0 ${dy})`}><path d="M24 24 L76 76" stroke={stroke} strokeWidth={w} {...line} /><path d="M76 24 L24 76" stroke={stroke} strokeWidth={w} {...line} /></g>
    : <circle cx="50" cy={50 + dy} r="27" stroke={stroke} strokeWidth={w} {...line} />;
  return (
    <motion.svg viewBox="0 0 100 100" className="w-[64%] h-[64%] overflow-visible"
      initial={{ scale: 0.3, rotate: mark === "x" ? -30 : 30, opacity: 0 }}
      animate={{ scale: 1, rotate: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 15 }}>
      {shape("var(--color-ink-day)", 22, 5)}
      {shape("var(--color-ink-day)", 22)}
      {shape(SEAT_CSS[mark], 12)}
      {mark === "o"
        ? <ellipse cx="33" cy="30" rx="5" ry="3" transform="rotate(-40 33 30)" fill="white" opacity=".85" />
        : <ellipse cx="30" cy="27" rx="4" ry="2.4" transform="rotate(45 30 27)" fill="white" opacity=".8" />}
    </motion.svg>
  );
}

export function Board({
  board, target, line, canPick, compact = false, width, onPick, owners = SOLO_OWNERS,
}: {
  board: Cell[]; target: number | null; line: number[] | null;
  canPick: boolean; compact?: boolean;
  /** who each seat is, for the screen-reader labels */
  owners?: Owners;
  /** the width the screen can give it, measured by PlayBoard. Without one it
      falls back to the old width-driven sizing, which is what the room
      screens and the result cards still want. */
  width?: number;
  onPick: (i: number) => void;
}) {
  return (
    // The board shrinks while a question is up. At full size the options sit
    // below the fold, and you cannot judge whether a square is worth fighting
    // for without seeing the board it belongs to.
    <motion.div
      className={`card grid grid-cols-3 mx-auto p-[3%] ${width ? "" : "w-full"}`}
      style={width ? { width } : undefined}
      animate={{ maxWidth: width ?? (compact ? 188 : 336), gap: width ? Math.max(4, width * 0.03) : compact ? 6 : 10 }}
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
            aria-label={cell
              ? `Square ${i + 1}, ${whose(owners, cell)}${won ? ", in the winning line" : ""}`
              : `Square ${i + 1}, open${contested ? ", being played for" : ""}`}
            className={`${pickable ? "tap" : ""} aspect-square grid place-items-center rounded-[14px]
              ${won ? "bg-leaf-hi" : contested ? "bg-petal-hi" : open ? "bg-mist" : "bg-board"}
              ${pickable ? "cursor-pointer hover:bg-sky-hi/40" : "cursor-default"}`}
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
