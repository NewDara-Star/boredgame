/** The share card's picture for Connect 4: the frame as it finished, the winning
    four lit, discs outlined in the seat colours. */
import { ball, rounded, type Hero } from "@/shared/card/frame";
import { RAMPS } from "@/shared/brand/tokens";
import { SEAT_RAMP } from "@/shared/brand/seats";
import { COLS, ROWS, type Cell } from "./rules";

export const c4Hero = (board: Cell[] | null | undefined, line: number[] | null = null): Hero => (c, box) => {
  const cell = Math.min(box.w / (COLS + 0.4), box.h / (ROWS + 0.4));
  const w = cell * (COLS + 0.4), h = cell * (ROWS + 0.4);
  const x0 = box.x + (box.w - w) / 2, y0 = box.y + (box.h - h) / 2;
  c.save();
  rounded(c, x0, y0, w, h, cell * 0.45); c.fillStyle = RAMPS.sky.deep; c.fill();
  for (let r = 0; r < ROWS; r++) for (let k = 0; k < COLS; k++) {
    const i = r * COLS + k, cx = x0 + cell * 0.2 + cell * k + cell / 2, cy = y0 + cell * 0.2 + cell * r + cell / 2;
    const v = board?.[i];
    if (line?.includes(i)) { c.beginPath(); c.arc(cx, cy, cell * 0.47, 0, Math.PI * 2); c.fillStyle = RAMPS.leaf.hi; c.fill(); }
    if (!v) { c.beginPath(); c.arc(cx, cy, cell * 0.36, 0, Math.PI * 2); c.fillStyle = "rgba(35,26,61,.45)"; c.fill(); }
    else ball(c, cx, cy, cell * 0.36, SEAT_RAMP[v]);
  }
  c.restore();
};
