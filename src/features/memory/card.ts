/** The result card's picture: the sixteen tiles, each pair in its winner's colour. */
import { COLOUR, INK, rounded, tint, type Hero } from "@/shared/card/frame";
import { COLS, FACES, SIZE, type Cell } from "./rules";

export const memoryHero = (deck: number[], board: Cell[]): Hero => (c, box) => {
  const tile = 74, gap = 10, rows = SIZE / COLS;
  const w = COLS * tile + (COLS - 1) * gap, h = rows * tile + (rows - 1) * gap;
  const x0 = box.x + (box.w - w) / 2, y0 = box.y + (box.h - h) / 2;
  for (let i = 0; i < SIZE; i++) {
    const owner = board[i];
    const x = x0 + (i % COLS) * (tile + gap), y = y0 + Math.floor(i / COLS) * (tile + gap);
    c.fillStyle = INK; rounded(c, x, y + 5, tile, tile, 16); c.fill();
    c.fillStyle = owner ? tint(COLOUR[owner], 0.25) : "#FFFFFF";
    rounded(c, x, y, tile, tile, 16); c.fill();
    c.lineWidth = 5; c.strokeStyle = INK; rounded(c, x, y, tile, tile, 16); c.stroke();
    if (!owner) continue;
    c.font = `40px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
    c.fillStyle = INK;
    c.fillText(FACES[deck[i]], x + tile / 2, y + tile / 2 + 3);
  }
};
