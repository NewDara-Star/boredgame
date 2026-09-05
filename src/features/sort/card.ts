/** The result card's picture: the tubes as they finished, lit the way the board lights them. */
import { artStage, INK as INK_, type Glyph, type Hero } from "@/shared/card/frame";
import { BALL } from "./Board";
import type { Tube } from "./rules";

export const sortHero = (tubes: Tube[], cap: number): Hero => (c, box) => {
  const tw = 68, gap = 24, r = 27, slot = 60;
  const n = tubes.length;
  const w = n * tw + (n - 1) * gap, h = cap * slot + 20;
  const x0 = box.x + (box.w - w) / 2, top = box.y + (box.h - h) / 2;
  tubes.forEach((t, i) => {
    const x = x0 + i * (tw + gap);
    // the glass: a rounded-bottom tube
    c.beginPath();
    c.moveTo(x, top); c.lineTo(x, top + h - tw / 2);
    c.arc(x + tw / 2, top + h - tw / 2, tw / 2, Math.PI, 0, true);
    c.lineTo(x + tw, top);
    c.fillStyle = "rgba(20,16,13,.05)"; c.fill();
    c.lineWidth = 5; c.strokeStyle = INK_; c.stroke();
    // the rim
    c.beginPath(); c.ellipse(x + tw / 2, top, tw / 2, 5, 0, 0, Math.PI * 2);
    c.fillStyle = "#FBF4E6"; c.fill(); c.stroke();
    t.forEach((colour, k) => {
      const cx = x + tw / 2, cy = top + h - 14 - r - k * slot;
      const [hi, mid, lo] = BALL[colour % BALL.length];
      const g = c.createRadialGradient(cx - r * 0.3, cy - r * 0.4, r * 0.1, cx, cy, r * 1.1);
      g.addColorStop(0, hi); g.addColorStop(0.34, mid); g.addColorStop(1, lo);
      c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.fillStyle = g; c.fill();
    });
  });
};

/** A seat is a ball here, not an X or an O: the host's red, the guest's blue. */
export const ballGlyph: Glyph = (c, mark, cx, cy, s) => {
  const r = s / 2;
  const [hi, mid, lo] = BALL[mark === "x" ? 0 : 1];
  const g = c.createRadialGradient(cx - r * 0.3, cy - r * 0.4, r * 0.1, cx, cy, r * 1.1);
  g.addColorStop(0, hi); g.addColorStop(0.34, mid); g.addColorStop(1, lo);
  c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.fillStyle = g; c.fill();
};

/** The session card's picture: three tubes — one home, one mixed, one empty. */
export const sortArt = (name: string): Hero => (c, box) =>
  artStage(c, box, name, 3, (c, _w, h) => {
    const tubesShown: Tube[] = [[0, 0, 0, 0], [1, 3, 1, 4], []];
    const th = h * 0.9, tw = th * 0.27, gap = tw * 0.45, r = tw * 0.4, slot = (th - 20) / 4;
    const w = 3 * tw + 2 * gap;
    tubesShown.forEach((t, i) => {
      const x = -w / 2 + i * (tw + gap), top = -th / 2;
      c.beginPath(); c.moveTo(x, top); c.lineTo(x, top + th - tw / 2);
      c.arc(x + tw / 2, top + th - tw / 2, tw / 2, Math.PI, 0, true); c.lineTo(x + tw, top);
      c.fillStyle = "rgba(20,16,13,.06)"; c.fill(); c.lineWidth = 7; c.strokeStyle = INK_; c.stroke();
      c.beginPath(); c.ellipse(x + tw / 2, top, tw / 2, 7, 0, 0, Math.PI * 2);
      c.fillStyle = "#FBF4E6"; c.fill(); c.stroke();
      t.forEach((colour, k) => {
        const cx = x + tw / 2, cy = top + th - 14 - r - k * slot;
        const [hi, mid, lo] = BALL[colour];
        const g = c.createRadialGradient(cx - r * 0.3, cy - r * 0.4, r * 0.1, cx, cy, r * 1.1);
        g.addColorStop(0, hi); g.addColorStop(0.34, mid); g.addColorStop(1, lo);
        c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.fillStyle = g; c.fill();
      });
    });
  });
