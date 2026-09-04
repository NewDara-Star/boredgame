/**
 * The result card you can actually keep. Drawn straight onto a canvas rather
 * than screenshotting the DOM: no extra dependency, no html2canvas guessing at
 * CSS it does not implement, and it comes out at a fixed 1080 square whatever
 * phone it was played on.
 */

const PAPER = "#F3EDE3";
const INK = "#191510";
const SAND = "#E7DFD1";
const POP = "#FFC93C";
const PICTO = "#EF5A2A";
const TRIVIA = "#4B5BD6";
const SIZE = 1080;

function rounded(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

/** Outline plus a hard offset shadow — the same primitive as `.piece` in CSS. */
function piece(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number,
               r: number, fill: string, drop = 12) {
  c.fillStyle = INK;
  rounded(c, x, y + drop, w, h, r); c.fill();
  c.fillStyle = fill;
  rounded(c, x, y, w, h, r); c.fill();
  c.lineWidth = 7; c.strokeStyle = INK;
  rounded(c, x, y, w, h, r); c.stroke();
}

function mark(c: CanvasRenderingContext2D, kind: "x" | "o", cx: number, cy: number, s: number) {
  c.lineWidth = s * 0.26; c.lineCap = "round"; c.strokeStyle = kind === "x" ? PICTO : TRIVIA;
  c.beginPath();
  if (kind === "x") {
    c.moveTo(cx - s / 2, cy - s / 2); c.lineTo(cx + s / 2, cy + s / 2);
    c.moveTo(cx + s / 2, cy - s / 2); c.lineTo(cx - s / 2, cy + s / 2);
  } else {
    c.arc(cx, cy, s / 2, 0, Math.PI * 2);
  }
  c.stroke();
}

/** Shrinks the type until the name fits rather than letting it run off the card. */
function fitText(c: CanvasRenderingContext2D, text: string, max: number, start: number) {
  let size = start;
  do {
    c.font = `600 ${size}px Fredoka, system-ui, sans-serif`;
    size -= 2;
  } while (c.measureText(text).width > max && size > 20);
  return text;
}

export interface Side { name: string; score: number; mark: "x" | "o" }

export async function drawMatchCard(code: string, a: Side, b: Side): Promise<string> {
  // Without this the first render falls back to a system font mid-draw.
  if (document.fonts?.ready) { try { await document.fonts.ready; } catch { /* older browsers */ } }

  const canvas = document.createElement("canvas");
  canvas.width = SIZE; canvas.height = SIZE;
  const c = canvas.getContext("2d");
  if (!c) throw new Error("canvas unavailable");

  c.fillStyle = PAPER; c.fillRect(0, 0, SIZE, SIZE);
  c.fillStyle = SAND;
  for (let y = 30; y < SIZE; y += 46) {
    for (let x = 30; x < SIZE; x += 46) { c.beginPath(); c.arc(x, y, 3.2, 0, Math.PI * 2); c.fill(); }
  }

  c.textAlign = "center"; c.textBaseline = "middle";
  c.fillStyle = INK;
  c.font = "800 30px Nunito, system-ui, sans-serif";
  c.fillText("S Q U A R E   O F F", SIZE / 2, 110);

  const winner = a.score === b.score ? null : a.score > b.score ? a : b;
  c.font = "600 62px Fredoka, system-ui, sans-serif";
  c.fillText(winner ? `${winner.name} wins the session` : "All square", SIZE / 2, 186);

  // Two panels, the winner's in yellow.
  const panelW = 400, panelH = 400, gap = 40;
  const left = (SIZE - panelW * 2 - gap) / 2;
  [a, b].forEach((side, i) => {
    const x = left + i * (panelW + gap);
    const y = 270;
    const won = winner === side;
    piece(c, x, y, panelW, panelH, 46, won ? POP : "#FFFFFF");
    mark(c, side.mark, x + panelW / 2, y + 108, 96);
    c.fillStyle = INK;
    fitText(c, side.name, panelW - 60, 46);
    c.fillText(side.name, x + panelW / 2, y + 218);
    c.font = "600 150px Fredoka, system-ui, sans-serif";
    c.fillText(String(side.score), x + panelW / 2, y + 320);
  });

  piece(c, left, 740, panelW * 2 + gap, 132, 38, "#FFFFFF");
  c.fillStyle = INK;
  c.font = "800 26px Nunito, system-ui, sans-serif";
  c.fillText(`ROOM ${code}`, SIZE / 2, 786);
  c.fillStyle = "#6B6154";
  c.font = "700 24px Nunito, system-ui, sans-serif";
  c.fillText(new Date().toLocaleDateString(undefined,
    { day: "numeric", month: "long", year: "numeric" }), SIZE / 2, 830);

  c.font = "600 34px Fredoka, system-ui, sans-serif";
  c.fillStyle = INK; c.fillText("Bored", SIZE / 2 - 42, 970);
  c.fillStyle = PICTO; c.fillText("Game", SIZE / 2 + 46, 970);

  return canvas.toDataURL("image/png");
}

/** Hands the browser a file. Only place in the app that does. */
export function downloadCard(dataUrl: string, code: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = `square-off-${code.toLowerCase()}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
