/** The result card's picture: the seven columns, and the four that won. */
import { COLOUR, GOOD, INK, type Hero } from "@/shared/card/frame";
import { COLS, ROWS, type Cell } from "./rules";

export const connect4Hero = (board: Cell[], line: number[] | null): Hero => (c, box) => {
  const hole = 52, gap = 6;
  const w = COLS * hole + (COLS - 1) * gap, h = ROWS * hole + (ROWS - 1) * gap;
  const x0 = box.x + (box.w - w) / 2, y0 = box.y + (box.h - h) / 2;
  for (let r = 0; r < ROWS; r++) for (let col = 0; col < COLS; col++) {
    const i = r * COLS + col;
    const cx = x0 + col * (hole + gap) + hole / 2, cy = y0 + r * (hole + gap) + hole / 2;
    const won = !!line?.includes(i);
    c.beginPath(); c.arc(cx, cy, hole / 2, 0, Math.PI * 2);
    c.fillStyle = won ? GOOD : "#FFFFFF"; c.fill();
    c.lineWidth = 4; c.strokeStyle = INK; c.stroke();
    const cell = board[i];
    if (!cell) continue;
    c.beginPath(); c.arc(cx, cy, hole * 0.39, 0, Math.PI * 2);
    c.fillStyle = COLOUR[cell]; c.fill();
  }
};
