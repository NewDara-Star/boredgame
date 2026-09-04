/**
 * The result card you can actually keep. Drawn straight onto a canvas rather
 * than screenshotting the DOM: no extra dependency, no html2canvas guessing at
 * CSS it does not implement, and it comes out at a fixed 1080 square whatever
 * phone it was played on.
 */

const HOT = "#FF2E88";
const INK = "#14100D";
const POP = "#FFD028";
const PICTO = "#FF5A1F";
const TRIVIA = "#2B4BFF";
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
               r: number, fill: string, drop = 14) {
  c.fillStyle = INK;
  rounded(c, x, y + drop, w, h, r); c.fill();
  c.fillStyle = fill;
  rounded(c, x, y, w, h, r); c.fill();
  c.lineWidth = 8; c.strokeStyle = INK;
  rounded(c, x, y, w, h, r); c.stroke();
}

/** White fill, heavy ink outline, hard offset shadow. The whole brand in one call. */
function sticker(c: CanvasRenderingContext2D, text: string, x: number, y: number,
                 size: number, fill = "#FFFFFF", drop = 8) {
  c.font = `600 ${size}px Fredoka, system-ui, sans-serif`;
  c.lineJoin = "round"; c.miterLimit = 2;
  c.lineWidth = size * 0.26; c.strokeStyle = INK;
  c.strokeText(text, x, y + drop); c.fillStyle = INK; c.fillText(text, x, y + drop);
  c.strokeText(text, x, y); c.fillStyle = fill; c.fillText(text, x, y);
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

function star(c: CanvasRenderingContext2D, cx: number, cy: number, r: number, fill: string) {
  c.save(); c.translate(cx, cy); c.fillStyle = fill; c.beginPath();
  const pts = [[0, -1], [0.2, -0.2], [1, 0], [0.2, 0.2], [0, 1], [-0.2, 0.2], [-1, 0], [-0.2, -0.2]];
  pts.forEach(([px, py], i) => (i ? c.lineTo(px * r, py * r) : c.moveTo(px * r, py * r)));
  c.closePath(); c.fill(); c.restore();
}

/**
 * The sparkles sit inside the headline's width, so a long name ran underneath
 * them. Widening the gap would mean moving the sparkles, and shrinking the type
 * far enough for a 20-character name puts the headline below the score labels —
 * type squeezed to fit reads as a mistake, an elided name reads as a name.
 * The full name is still printed under the mark, so nothing is actually lost.
 */
const HEADLINE_CHARS = 14;
/** Clear of the left sparkle (ends at x=190) and the right one (starts at 918),
    measured from the centre the headline is drawn on. */
const HEADLINE_WIDTH = 700;

const ellipsize = (text: string, n: number) =>
  text.length <= n ? text : `${text.slice(0, n - 1).trimEnd()}…`;

/** Shrinks the type until the name fits rather than letting it run off the card. */
function fitSize(c: CanvasRenderingContext2D, text: string, max: number, start: number) {
  let size = start;
  do {
    c.font = `600 ${size}px Fredoka, system-ui, sans-serif`;
    size -= 2;
  } while (c.measureText(text).width > max && size > 20);
  return size;
}

export interface Side { name: string; score: number; mark: "x" | "o" }

/** `url` is for putting it on screen, `file` is for getting it off the screen.
    Both come from the same canvas, and the file is built up front on purpose —
    see saveCard(). */
export interface MatchCard { url: string; file: File }

export async function drawMatchCard(code: string | null, a: Side, b: Side): Promise<MatchCard> {
  // Without this the first render falls back to a system font mid-draw.
  if (document.fonts?.ready) { try { await document.fonts.ready; } catch { /* older browsers */ } }

  const canvas = document.createElement("canvas");
  canvas.width = SIZE; canvas.height = SIZE;
  const c = canvas.getContext("2d");
  if (!c) throw new Error("canvas unavailable");

  c.fillStyle = HOT; c.fillRect(0, 0, SIZE, SIZE);

  // The tonal repeat behind everything, lifted straight off the reference boards.
  c.save();
  c.globalAlpha = 0.09; c.fillStyle = "#FFFFFF";
  c.font = "600 132px Fredoka, system-ui, sans-serif";
  c.textAlign = "left"; c.textBaseline = "alphabetic";
  for (let row = 0, y = 120; y < SIZE + 140; y += 128, row++) {
    c.fillText("SQUARE OFF  SQUARE OFF", -160 + (row % 2) * 130, y);
  }
  c.restore();

  c.textAlign = "center"; c.textBaseline = "middle";
  star(c, 128, 150, 62, POP);
  star(c, SIZE - 118, 196, 44, POP);

  const winner = a.score === b.score ? null : a.score > b.score ? a : b;
  const headline = winner ? `${ellipsize(winner.name, HEADLINE_CHARS)} wins` : "All square";
  const hs = fitSize(c, headline, HEADLINE_WIDTH, 96);
  sticker(c, headline, SIZE / 2, 200, hs, POP, 10);

  const panelW = 400, panelH = 400, gap = 40;
  const left = (SIZE - panelW * 2 - gap) / 2;
  [a, b].forEach((side, i) => {
    const x = left + i * (panelW + gap);
    const y = 300;
    piece(c, x, y, panelW, panelH, 48, winner === side ? POP : "#FFFFFF");
    mark(c, side.mark, x + panelW / 2, y + 110, 96);
    c.fillStyle = INK;
    c.font = `600 ${fitSize(c, side.name, panelW - 60, 46)}px Fredoka, system-ui, sans-serif`;
    c.fillText(side.name, x + panelW / 2, y + 222);
    c.font = "600 152px Fredoka, system-ui, sans-serif";
    c.fillText(String(side.score), x + panelW / 2, y + 322);
  });

  piece(c, left, 772, panelW * 2 + gap, 118, 40, "#FFFFFF");
  c.fillStyle = INK;
  c.font = "800 27px Nunito, system-ui, sans-serif";
  c.fillText(code ? `ROOM ${code}` : "SOLO v THE BOT", SIZE / 2, 812);
  c.fillStyle = "#6A6155";
  c.font = "700 24px Nunito, system-ui, sans-serif";
  c.fillText(new Date().toLocaleDateString(undefined,
    { day: "numeric", month: "long", year: "numeric" }), SIZE / 2, 852);

  sticker(c, "BoredGame", SIZE / 2, 990, 58, "#FFFFFF", 8);

  const name = `square-off-${(code ?? "solo").toLowerCase()}.png`;
  const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, "image/png"));
  return {
    url: canvas.toDataURL("image/png"),
    file: new File([blob ?? new Blob([], { type: "image/png" })], name, { type: "image/png" }),
  };
}

function viaLink(file: File) {
  // A blob: URL is same-origin and carries a real MIME type, so the download
  // attribute is honoured. Pointed at a data: URL it is not: Safari saves an
  // unnamed "Unknown" file and iOS ignores it entirely.
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoking immediately cancels the download in Safari, which reads the blob
  // after the click returns.
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/**
 * Gets the card off the screen. Only place in the app that hands over a file.
 *
 * Two things this must not do. It must not await anything before calling
 * share(): iOS requires transient activation, and a single await between the
 * tap and the call loses it — which is why the File is built when the card is
 * drawn rather than here. And it must not treat Web Share as present just
 * because `navigator.share` exists; desktop Chrome has it and refuses files.
 * `canShare({ files })` is the only test that answers the real question.
 *
 * On a phone this opens the share sheet, where "Save Image" is one tap. A
 * cancelled sheet is a choice, not a failure — anything else falls back to the
 * link, and the picture is still on screen to press and hold.
 */
export function saveCard(file: File) {
  if (navigator.canShare?.({ files: [file] })) {
    navigator.share({ files: [file] }).catch((e: unknown) => {
      if ((e as Error)?.name !== "AbortError") viaLink(file);
    });
    return;
  }
  viaLink(file);
}
