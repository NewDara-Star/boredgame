import { artStage, INK, rounded, TRIVIA, type Hero } from "@/shared/card/frame";


/** The session card's picture: four tiles, one turned, as on the catalogue. */
export const memoryArt = (name: string): Hero => (c, box) =>
  artStage(c, box, name, -3, (c, _w, h) => {
    const tile = h * 0.42, gap = tile * 0.16, s = tile * 2 + gap;
    const faces = ["⭐", "", "", "⭐"];
    for (let i = 0; i < 4; i++) {
      const x = -s / 2 + (i % 2) * (tile + gap), y = -s / 2 + Math.floor(i / 2) * (tile + gap);
      c.fillStyle = INK; rounded(c, x, y + 10, tile, tile, 22); c.fill();
      c.fillStyle = i === 1 ? TRIVIA : "#FFFFFF"; rounded(c, x, y, tile, tile, 22); c.fill();
      c.lineWidth = 8; c.strokeStyle = INK; rounded(c, x, y, tile, tile, 22); c.stroke();
      if (faces[i]) {
        c.font = `${tile * 0.5}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
        c.fillText(faces[i], x + tile / 2, y + tile / 2 + tile * 0.04);
      }
    }
  });
