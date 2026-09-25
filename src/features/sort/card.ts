/** The result card's pictures for Ball Sort: the tubes (with a ball in
    flight, for the replay), and the artwork for a session card. */
import { INK as INK_, type Box, type Ctx, type Glyph, type Hero } from "@/shared/card/frame";
import { BOARD } from "@/shared/brand/tokens";
import { BALL } from "./Board";
import { markPath } from "./marks";
import type { Flight, Tube } from "./rules";

/** The tubes, drawn — the way the board lights them — with a ball in flight
    if there is one. The result card, and every frame of a replay. */
export function drawTubes(c: Ctx, box: Box, tubes: Tube[], cap: number, flight: Flight | null = null) {
  const tw = 68, gap = 24, r = 27, slot = 60;
  const n = tubes.length;
  const w = n * tw + (n - 1) * gap, h = cap * slot + 20;
  const x0 = box.x + (box.w - w) / 2, top = box.y + (box.h - h) / 2;
  const centre = (i: number, k: number) => ({ x: x0 + i * (tw + gap) + tw / 2, y: top + h - 14 - r - k * slot });
  const ball = (cx: number, cy: number, colour: number) => {
    const [hi, mid, lo] = BALL[colour % BALL.length];
    const g = c.createRadialGradient(cx - r * 0.3, cy - r * 0.4, r * 0.1, cx, cy, r * 1.1);
    g.addColorStop(0, hi); g.addColorStop(0.34, mid); g.addColorStop(1, lo);
    c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.fillStyle = g; c.fill();
    // the colour's mark, as on the board (talk item 15)
    c.save(); c.globalAlpha = 0.8; c.fillStyle = INK_;
    c.fill(new Path2D(markPath(colour, cx, cy + r * 0.06, r * 0.44)), "evenodd");
    c.restore();
  };
  tubes.forEach((t, i) => {
    const x = x0 + i * (tw + gap);
    // the glass: a rounded-bottom tube
    c.beginPath();
    c.moveTo(x, top); c.lineTo(x, top + h - tw / 2);
    c.arc(x + tw / 2, top + h - tw / 2, tw / 2, Math.PI, 0, true);
    c.lineTo(x + tw, top);
    c.fillStyle = "rgba(255,255,255,.55)"; c.fill();
    c.lineWidth = 5; c.strokeStyle = INK_; c.stroke();
    // the rim
    c.beginPath(); c.ellipse(x + tw / 2, top, tw / 2, 5, 0, 0, Math.PI * 2);
    c.fillStyle = BOARD; c.fill(); c.stroke();
    t.forEach((colour, k) => { const p = centre(i, k); ball(p.x, p.y, colour); });
  });
  if (flight) {
    // out of the source tube, over the rims, into the destination: an arc
    // whose ends are the slots the ball left and will fill
    const a = centre(flight.from, tubes[flight.from].length), b = centre(flight.to, tubes[flight.to].length);
    const k = Math.max(0, Math.min(1, flight.k));
    const ease = k * k * (3 - 2 * k);
    const lift = top - r - 34;
    const x = a.x + (b.x - a.x) * ease;
    const y = a.y + (b.y - a.y) * ease - (a.y + (b.y - a.y) * ease - lift) * Math.sin(Math.PI * k) * 0.98;
    ball(x, Math.min(y, Math.max(a.y, b.y)), flight.colour);
  }
}

/** The result card's picture: the tubes as they finished. */
export const sortHero = (tubes: Tube[], cap: number): Hero => (c, box) => drawTubes(c, box, tubes, cap);

/** A seat is a ball here, not an X or an O: the host's red, the guest's blue. */
export const ballGlyph: Glyph = (c, mark, cx, cy, s) => {
  const r = s / 2;
  const colour = mark === "x" ? 0 : 1;
  const [hi, mid, lo] = BALL[colour];
  const g = c.createRadialGradient(cx - r * 0.3, cy - r * 0.4, r * 0.1, cx, cy, r * 1.1);
  g.addColorStop(0, hi); g.addColorStop(0.34, mid); g.addColorStop(1, lo);
  c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.fillStyle = g; c.fill();
  c.save(); c.globalAlpha = 0.8; c.fillStyle = INK_;
  c.fill(new Path2D(markPath(colour, cx, cy + r * 0.06, r * 0.44)), "evenodd");
  c.restore();
};
