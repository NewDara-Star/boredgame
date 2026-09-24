import { motion } from "framer-motion";
import { SPRING } from "@/shared/ui/motion";
import { COLS, ROWS, landingRow, type Cell } from "./rules";
import { SEAT_RAMP } from "@/shared/brand/seats";

/**
 * The whole column is the tap target, not the individual cell. On a phone the
 * bottom cell of a column is a 40px square, and asking someone to hit the one
 * empty slot in a stack is a worse game than asking them to hit the column.
 */
export function Board({
  board, target, line, canPick, compact = false, width, onPick,
}: {
  board: Cell[]; target: number | null; line: number[] | null;
  canPick: boolean; compact?: boolean;
  /** the width the screen can give it — see PlayBoard */
  width?: number;
  onPick: (col: number) => void;
}) {
  return (
    // The frame is the one Connect 4 has always had: a deep blue board with holes,
    // and the discs (subjects) sit in it outlined, lit from the top left.
    <motion.div
      className={`grid grid-cols-7 mx-auto p-[2.5%] rounded-[22px] bg-sky-deep shadow-lift ${width ? "" : "w-full"}`}
      style={width ? { width } : undefined}
      animate={{ maxWidth: width ?? (compact ? 260 : 360), gap: width ? Math.max(2, width * 0.014) : compact ? 3 : 5 }}
      transition={SPRING}>
      {Array.from({ length: COLS }, (_, c) => {
        const open = landingRow(board, c) >= 0;
        const pickable = canPick && open;
        const contested = target === c;
        return (
          <button
            key={c}
            disabled={!pickable}
            onClick={() => pickable && onPick(c)}
            aria-label={open ? `Column ${c + 1}, open` : `Column ${c + 1}, full`}
            className={`flex flex-col rounded-[12px] p-[2px]
              ${pickable ? "tap cursor-pointer hover:bg-sky/60" : "cursor-default"}
              ${contested ? "bg-petal/70" : "bg-transparent"}`}
            style={{ gap: width ? Math.max(2, width * 0.014) : compact ? 3 : 5 }}>
            {Array.from({ length: ROWS }, (_, r) => {
              const i = r * COLS + c;
              const cell = board[i];
              const won = line?.includes(i);
              return (
                <span key={r}
                  className={`aspect-square rounded-full grid place-items-center
                    ${won ? "bg-leaf-hi" : "bg-ink/45"}`}
                  style={{ boxShadow: "inset 0 3px 0 rgba(0,0,0,.25)" }}>
                  {cell && (
                    // Dropped, not faded in: the disc arrives from above so you
                    // can see which column it fell down.
                    <motion.span
                      className="block rounded-full"
                      style={{ width: "84%", height: "84%",
                        background: `radial-gradient(circle at 34% 30%, ${SEAT_RAMP[cell].hi}, ${SEAT_RAMP[cell].base} 58%, ${SEAT_RAMP[cell].lo})`,
                        boxShadow: "0 0 0 2.5px var(--color-ink-day), 0 3px 0 2.5px var(--color-ink-day)" }}
                      initial={{ y: -140, opacity: 0 }}
                      animate={won
                        ? { y: 0, opacity: 1, scale: [1, 1.18, 1] }
                        : { y: 0, opacity: 1, scale: 1 }}
                      transition={won
                        ? { ...SPRING, delay: (line?.indexOf(i) ?? 0) * 0.09 }
                        : { type: "spring", stiffness: 420, damping: 24 }} />
                  )}
                </span>
              );
            })}
            <span className={`font-display font-semibold tabular-nums text-center leading-none pt-[3px]
              ${compact ? "text-[12px]" : "text-xs"} ${pickable ? "text-sky-hi" : "text-sky/50"}`}>
              {c + 1}
            </span>
          </button>
        );
      })}
    </motion.div>
  );
}
