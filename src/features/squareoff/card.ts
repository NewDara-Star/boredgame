/**
 * The result card's picture for the 3×3 games: the final grid, as it stood.
 * Square Off and Tic Tac Toe share the board, so they share this.
 */
import { COLOUR, GOOD, INK, rounded, tint, type Hero } from "@/shared/card/frame";
import type { Cell } from "./rules";

export const gridHero = (board: Cell[], line: number[] | null): Hero => (c, box) => {
  const cell = 104, gap = 12, side = cell * 3 + gap * 2;
  const x0 = box.x + (box.w - side) / 2, y0 = box.y + (box.h - side) / 2;
  for (let i = 0; i < 9; i++) {
    const owner = board[i];
    const won = !!line?.includes(i);
    const x = x0 + (i % 3) * (cell + gap), y = y0 + Math.floor(i / 3) * (cell + gap);
    c.fillStyle = won ? GOOD : owner ? tint(COLOUR[owner], 0.18) : "#FFFFFF";
    rounded(c, x, y, cell, cell, 22); c.fill();
    c.lineWidth = 6; c.strokeStyle = INK; rounded(c, x, y, cell, cell, 22); c.stroke();
    if (!owner) continue;
    const cx = x + cell / 2, cy = y + cell / 2, s = cell * 0.5;
    c.lineWidth = 12; c.lineCap = "round"; c.strokeStyle = won ? "#FFFFFF" : COLOUR[owner];
    c.beginPath();
    if (owner === "x") {
      c.moveTo(cx - s / 2, cy - s / 2); c.lineTo(cx + s / 2, cy + s / 2);
      c.moveTo(cx + s / 2, cy - s / 2); c.lineTo(cx - s / 2, cy + s / 2);
    } else c.arc(cx, cy, s / 2, 0, Math.PI * 2);
    c.stroke();
  }
};
