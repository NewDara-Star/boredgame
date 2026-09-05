/**
 * The session card's picture for the 3×3 games. Square Off and Tic Tac Toe
 * share the board, so they share this — with their own marks on it.
 */
import { artStage, COLOUR, INK, type Hero } from "@/shared/card/frame";
import type { Cell } from "./rules";

/** The session card's picture: the hash, as on the catalogue, at card size. */
export const gridArt = (name: string, marks: [Cell, Cell, Cell, Cell, Cell, Cell, Cell, Cell, Cell]): Hero =>
  (c, box) => artStage(c, box, name, -4, (c, _w, h) => {
    const s = h * 0.92, cell = s / 3;
    c.lineWidth = 10; c.lineCap = "round"; c.strokeStyle = INK;
    c.beginPath();
    for (const k of [1, 2]) {
      c.moveTo(-s / 2 + cell * k, -s / 2 + 8); c.lineTo(-s / 2 + cell * k, s / 2 - 8);
      c.moveTo(-s / 2 + 8, -s / 2 + cell * k); c.lineTo(s / 2 - 8, -s / 2 + cell * k);
    }
    c.stroke();
    marks.forEach((m, i) => {
      if (!m) return;
      const cx = -s / 2 + cell * (i % 3) + cell / 2, cy = -s / 2 + cell * Math.floor(i / 3) + cell / 2;
      const r = cell * 0.26;
      c.lineWidth = 16; c.strokeStyle = COLOUR[m]; c.beginPath();
      if (m === "x") { c.moveTo(cx - r, cy - r); c.lineTo(cx + r, cy + r); c.moveTo(cx + r, cy - r); c.lineTo(cx - r, cy + r); }
      else c.arc(cx, cy, r, 0, Math.PI * 2);
      c.stroke();
    });
  });

export const SQUARE_OFF_ART: Hero = gridArt("SQUARE OFF", ["x", null, null, null, "o", null, null, null, "x"]);
export const TIC_TAC_TOE_ART: Hero = gridArt("TIC TAC TOE", ["x", "o", "x", null, "o", null, null, null, null]);
export const CATAPULT_SQUARES_ART: Hero = gridArt("CATAPULT SQUARES", ["x", null, "o", null, "x", null, "o", null, null]);
