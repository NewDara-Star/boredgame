import { motion } from "framer-motion";
import { SPRING } from "@/shared/ui/motion";
import { SQUARE_NAMES, type Cell, type Mark } from "./rules";
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
    <motion.svg viewBox="0 0 100 100" className="w-[66%] h-[66%] overflow-visible"
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
  board, target, line, canPick, compact = false, width, onPick, owners = SOLO_OWNERS, tint = false,
}: {
  board: Cell[]; target: number | null; line: number[] | null;
  canPick: boolean; compact?: boolean;
  /** who each seat is, for the screen-reader labels */
  owners?: Owners;
  /** the width the screen can give it, measured by PlayBoard. Without one it
      falls back to the old width-driven sizing, which is what the room
      screens and the result cards still want. */
  width?: number;
  /** a claimed square takes its owner's pale colour (Square Off, #26's .sq);
      plain Tic Tac Toe keeps every square mist (#25's .g3) */
  tint?: boolean;
  onPick: (i: number) => void;
}) {
  // From the drawings' code: .board (white, 24px corners, 10px in) holding .g3
  // (7px apart, 14px corners, mist squares, pieces at 66%). No numbers: the
  // words name squares by where they are. While a question is up the board
  // drops to 62% and the square in play is white with an ink ring (.sq i.pick).
  const size = width ? (compact ? Math.round(width * 0.62) : width) : undefined;
  return (
    <motion.div
      className={`bg-board rounded-[24px] shadow-lift-sm grid grid-cols-3 mx-auto p-2.5 ${width ? "" : "w-full"}`}
      style={size ? { width: size } : undefined}
      animate={{ maxWidth: size ?? (compact ? 188 : 336), gap: compact ? 6 : 7 }}
      transition={SPRING}>
      {board.map((cell, i) => {
        const contested = target === i && !cell;
        const won = line?.includes(i);
        const open = cell === null;
        const pickable = canPick && open;
        const name = `${SQUARE_NAMES[i].charAt(0).toUpperCase()}${SQUARE_NAMES[i].slice(1)} square`;
        const bg = won ? "bg-petal-hi"
          : contested ? "bg-board shadow-[inset_0_0_0_3px_var(--color-ink-day)]"
          : tint && cell === "x" ? "bg-petal-hi" : tint && cell === "o" ? "bg-sky-hi" : "bg-mist";
        return (
          <motion.button
            key={i}
            disabled={!pickable}
            onClick={() => pickable && onPick(i)}
            aria-label={cell
              ? `${name}, ${whose(owners, cell)}${won ? ", in the winning line" : ""}`
              : `${name}, open${contested ? ", being played for" : ""}`}
            className={`${pickable ? "tap cursor-pointer" : "cursor-default"} aspect-square grid place-items-center
              ${compact ? "rounded-[12px]" : "rounded-[14px]"} ${bg}`}
            animate={won ? { scale: [1, 1.1, 1] } : { scale: 1 }}
            transition={won ? { ...SPRING, delay: (line?.indexOf(i) ?? 0) * 0.09 } : SPRING}>
            {cell && <Glyph mark={cell} />}
          </motion.button>
        );
      })}
    </motion.div>
  );
}
