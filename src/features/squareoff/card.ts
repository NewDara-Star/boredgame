/**
 * The share card's picture for the 3×3 games (Square Off, Tic Tac Toe, Catapult
 * Squares): the board as it finished, pieces outlined in the seat colours, and the
 * winning line drawn through them. The real result, not a stock drawing.
 */
import { subjectStroke, type Hero } from "@/shared/card/frame";
import { RAMPS } from "@/shared/brand/tokens";
import { SEAT_RAMP } from "@/shared/brand/seats";
import type { Cell } from "./rules";

export const gridHero = (board: Cell[] | null | undefined, line: number[] | null = null): Hero => (c, box) => {
  const s = Math.min(box.w, box.h) * 0.98, cell = s / 3;
  const x0 = box.x + (box.w - s) / 2, y0 = box.y + (box.h - s) / 2;
  const centre = (i: number) => ({ x: x0 + cell * (i % 3) + cell / 2, y: y0 + cell * Math.floor(i / 3) + cell / 2 });
  c.save();
  c.strokeStyle = "rgba(35,26,61,.18)"; c.lineWidth = 10; c.lineCap = "round"; c.beginPath();
  for (const k of [1, 2]) {
    c.moveTo(x0 + cell * k, y0 + 14); c.lineTo(x0 + cell * k, y0 + s - 14);
    c.moveTo(x0 + 14, y0 + cell * k); c.lineTo(x0 + s - 14, y0 + cell * k);
  }
  c.stroke(); c.restore();
  (board ?? []).forEach((m, i) => {
    if (!m) return;
    const { x, y } = centre(i), r = cell * 0.27, w = cell * 0.15;
    if (m === "x") subjectStroke(c, () => { c.beginPath(); c.moveTo(x - r, y - r); c.lineTo(x + r, y + r); c.moveTo(x + r, y - r); c.lineTo(x - r, y + r); }, SEAT_RAMP.x.base, w, 6, 6);
    else subjectStroke(c, () => { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); }, SEAT_RAMP.o.base, w, 6, 6);
  });
  if (line && line.length >= 2) {
    const a = centre(line[0]), b = centre(line[line.length - 1]);
    subjectStroke(c, () => { c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); }, RAMPS.leaf.hi, cell * 0.11, 6, 0);
  }
};
