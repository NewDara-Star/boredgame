/** The result card's picture for a solo round: ten answers, right or wrong, and the score. */
import { BAD, DISPLAY, GOOD, INK, PICTO, type Hero } from "@/shared/card/frame";

export const roundHero = (results: { correct: boolean }[], score: number): Hero => (c, box) => {
  const n = Math.max(results.length, 1);
  const d = Math.min(58, (box.w - 40) / n - 14), gap = 14;
  const w = n * d + (n - 1) * gap;
  const x0 = box.x + (box.w - w) / 2, cy = box.y + 78;
  results.forEach((r, i) => {
    const cx = x0 + i * (d + gap) + d / 2;
    c.beginPath(); c.arc(cx, cy, d / 2, 0, Math.PI * 2);
    c.fillStyle = r.correct ? GOOD : BAD; c.fill();
    c.lineWidth = 5; c.strokeStyle = INK; c.stroke();
    c.lineWidth = 6; c.lineCap = "round"; c.strokeStyle = "#FFFFFF"; c.beginPath();
    const s = d * 0.22;
    if (r.correct) { c.moveTo(cx - s, cy); c.lineTo(cx - s * 0.2, cy + s * 0.8); c.lineTo(cx + s, cy - s * 0.8); }
    else { c.moveTo(cx - s, cy - s); c.lineTo(cx + s, cy + s); c.moveTo(cx + s, cy - s); c.lineTo(cx - s, cy + s); }
    c.stroke();
  });
  c.fillStyle = PICTO;
  c.font = `600 150px ${DISPLAY}`;
  c.fillText(score.toLocaleString(), box.x + box.w / 2, box.y + box.h - 100);
  c.fillStyle = INK;
  c.font = `600 30px ${DISPLAY}`;
  c.fillText("points", box.x + box.w / 2, box.y + box.h - 18);
};
