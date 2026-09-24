/** The share card's picture for a solo round: the ten answers as seeds, right in
    leaf and wrong in ember, and the score underneath. */
import { ball, DISPLAY, INK, type Hero } from "@/shared/card/frame";
import { RAMPS } from "@/shared/brand/tokens";

export const roundHero = (results: { correct: boolean }[], score: number): Hero => (c, box) => {
  const n = Math.max(results.length, 1), per = Math.min(5, n), rows = Math.ceil(n / per);
  const d = Math.min(100, (box.w - 40) / per - 24), gap = 26;
  const w = per * d + (per - 1) * gap;
  const x0 = box.x + (box.w - w) / 2, y0 = box.y + 30;
  results.forEach((r, i) => {
    const cx = x0 + (i % per) * (d + gap) + d / 2, cy = y0 + Math.floor(i / per) * (d + gap) + d / 2;
    ball(c, cx, cy, d / 2, r.correct ? RAMPS.leaf : RAMPS.ember);
    c.save(); c.strokeStyle = INK; c.lineWidth = d * 0.12; c.lineCap = "round"; c.lineJoin = "round"; c.beginPath();
    const s = d * 0.2;
    if (r.correct) { c.moveTo(cx - s, cy); c.lineTo(cx - s * 0.2, cy + s * 0.8); c.lineTo(cx + s, cy - s * 0.8); }
    else { c.moveTo(cx - s, cy - s); c.lineTo(cx + s, cy + s); c.moveTo(cx + s, cy - s); c.lineTo(cx - s, cy + s); }
    c.stroke(); c.restore();
  });
  c.fillStyle = INK; c.textAlign = "center"; c.textBaseline = "alphabetic";
  c.font = `400 76px ${DISPLAY}`;
  c.fillText(`${score.toLocaleString()} points`, box.x + box.w / 2, y0 + rows * (d + gap) + 80);
};
