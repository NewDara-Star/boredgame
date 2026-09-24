/** The share card's picture for Memory Match: the sixteen tiles as they finished,
    each one in the colour of the player who claimed it. */
import { cutPlate, type Hero } from "@/shared/card/frame";
import { RAMPS } from "@/shared/brand/tokens";
import { SEAT_RAMP } from "@/shared/brand/seats";
import { COLS, type Cell } from "./rules";

export const memoryHero = (board: Cell[] | null | undefined): Hero => (c, box) => {
  const n = board?.length || 16, rows = Math.ceil(n / COLS);
  const gap = 14, t = Math.min((box.w - gap * (COLS - 1)) / COLS, (box.h - gap * (rows - 1)) / rows);
  const x0 = box.x + (box.w - (t * COLS + gap * (COLS - 1))) / 2, y0 = box.y + (box.h - (t * rows + gap * (rows - 1))) / 2;
  for (let i = 0; i < n; i++) {
    const owner = board?.[i] ?? null;
    cutPlate(c, x0 + (i % COLS) * (t + gap), y0 + Math.floor(i / COLS) * (t + gap), t, t, t * 0.16, t * 0.1,
      owner ? SEAT_RAMP[owner] : RAMPS.grape, false);
  }
};
