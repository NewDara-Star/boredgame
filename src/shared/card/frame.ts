/**
 * The result card you can actually keep.
 *
 * Drawn straight onto a canvas rather than screenshotting the DOM: no extra
 * dependency, no html2canvas guessing at CSS it does not implement, and it
 * comes out at a fixed 1080 square whatever phone it was played on.
 *
 * The FRAME is shared — hot ground, the game's name repeated behind, the
 * headline, the score strip, the room and date, the wordmark. The middle of
 * the card is the game's own: each game draws its final board there with the
 * `hero` it passes in, so a Connect 4 card shows the four that won and a Ball
 * Sort card shows the tubes. One card with the title swapped was the same
 * picture nine times, which is not a picture of anything.
 */
import type { Mark } from "@/features/squareoff/rules";

export const INK = "#14100D";
export const HOT = "#FF2E88";
export const POP = "#FFD028";
export const PICTO = "#FF5A1F";
export const TRIVIA = "#2B4BFF";
export const GOOD = "#10A04E";
export const BAD = "#E31B33";
export const SAND = "#EFE3CB";
export const SOFT = "#6A6155";
export const SIZE = 1080;

export const COLOUR: Record<Mark, string> = { x: PICTO, o: TRIVIA };
export const DISPLAY = "Fredoka, system-ui, sans-serif";
export const BODY = "Nunito, system-ui, sans-serif";

export type Ctx = CanvasRenderingContext2D;
export interface Box { x: number; y: number; w: number; h: number }
export type Hero = (c: Ctx, box: Box) => void;
export type Glyph = (c: Ctx, mark: Mark, cx: number, cy: number, s: number) => void;

export function rounded(c: Ctx, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

/** Outline plus a hard offset shadow — the same primitive as `.piece` in CSS. */
export function piece(c: Ctx, x: number, y: number, w: number, h: number,
                      r: number, fill: string, drop = 14, line = 8) {
  c.fillStyle = INK;
  rounded(c, x, y + drop, w, h, r); c.fill();
  c.fillStyle = fill;
  rounded(c, x, y, w, h, r); c.fill();
  c.lineWidth = line; c.strokeStyle = INK;
  rounded(c, x, y, w, h, r); c.stroke();
}

/** White fill, heavy ink outline, hard offset shadow. The whole brand in one call. */
export function sticker(c: Ctx, text: string, x: number, y: number,
                        size: number, fill = "#FFFFFF", drop = 8) {
  c.font = `600 ${size}px ${DISPLAY}`;
  c.lineJoin = "round"; c.miterLimit = 2;
  c.lineWidth = size * 0.26; c.strokeStyle = INK;
  c.strokeText(text, x, y + drop); c.fillStyle = INK; c.fillText(text, x, y + drop);
  c.strokeText(text, x, y); c.fillStyle = fill; c.fillText(text, x, y);
}

/** The X and the O, drawn — the same strokes the boards use. */
export const markGlyph: Glyph = (c, kind, cx, cy, s) => {
  c.lineWidth = s * 0.26; c.lineCap = "round"; c.strokeStyle = COLOUR[kind];
  c.beginPath();
  if (kind === "x") {
    c.moveTo(cx - s / 2, cy - s / 2); c.lineTo(cx + s / 2, cy + s / 2);
    c.moveTo(cx + s / 2, cy - s / 2); c.lineTo(cx - s / 2, cy + s / 2);
  } else {
    c.arc(cx, cy, s / 2, 0, Math.PI * 2);
  }
  c.stroke();
};

export function star(c: Ctx, cx: number, cy: number, r: number, fill: string) {
  c.save(); c.translate(cx, cy); c.fillStyle = fill; c.beginPath();
  const pts = [[0, -1], [0.2, -0.2], [1, 0], [0.2, 0.2], [0, 1], [-0.2, 0.2], [-1, 0], [-0.2, -0.2]];
  pts.forEach(([px, py], i) => (i ? c.lineTo(px * r, py * r) : c.moveTo(px * r, py * r)));
  c.closePath(); c.fill(); c.restore();
}

/** A colour at some opacity over white — the `bg-picto/25` tints, in canvas. */
export function tint(hex: string, alpha: number) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const mix = (v: number) => Math.round(255 + (v - 255) * alpha);
  return `rgb(${mix(r)},${mix(g)},${mix(b)})`;
}

/**
 * The sparkles sit inside the headline's width, so a long name ran underneath
 * them. Widening the gap would mean moving the sparkles, and shrinking the type
 * far enough for a 20-character name puts the headline below the score labels —
 * type squeezed to fit reads as a mistake, an elided name reads as a name.
 * The full name is still printed in the score strip, so nothing is actually lost.
 */
export const HEADLINE_CHARS = 14;
/** Clear of the left sparkle (ends at x=190) and the right one (starts at 918). */
const HEADLINE_WIDTH = 700;

export const ellipsize = (text: string, n: number) =>
  text.length <= n ? text : `${text.slice(0, n - 1).trimEnd()}…`;

/** Shrinks the type until the text fits rather than letting it run off the card. */
export function fitSize(c: Ctx, text: string, max: number, start: number, weight = 600, family = DISPLAY) {
  let size = start;
  do {
    c.font = `${weight} ${size}px ${family}`;
    size -= 2;
  } while (c.measureText(text).width > max && size > 20);
  return size + 2;
}

export interface Side { name: string; score: number; mark: Mark }

export interface CardSpec {
  /** the game's name — repeated behind everything, and the file's name */
  title: string;
  headline: string;
  /** the game's own picture, drawn into the middle of the card */
  hero: Hero;
  /** the two seats and their scores; a solo round has none */
  sides?: [Side, Side];
  /** how a seat is drawn in the score strip — X and O unless the game says otherwise */
  glyph?: Glyph;
  /** the line under the picture — "Solved in 22 · par 21", "7 of 10 correct" */
  caption?: string;
  code: string | null;
  /** the footer's first line when it is not a room or the bot — "TODAY'S TUBES" */
  where?: string;
}

/** `url` is for putting it on screen, `file` is for getting it off the screen.
    Both come from the same canvas, and the file is built up front on purpose —
    see saveCard(). */
export interface MatchCard { url: string; file: File }

/** Where the hero goes: a white piece across the middle of the card. */
export const HERO: Box = { x: 100, y: 250, w: 880, h: 400 };

/** Waits for the card's fonts, once. Without this the first card of a
    session comes out in the system fallback mid-draw. */
export async function fontsReady() {
  if (document.fonts?.ready) { try { await document.fonts.ready; } catch { /* older browsers */ } }
}

export async function drawCard(spec: CardSpec): Promise<MatchCard> {
  await fontsReady();
  const canvas = document.createElement("canvas");
  canvas.width = SIZE; canvas.height = SIZE;
  const c = canvas.getContext("2d");
  if (!c) throw new Error("canvas unavailable");
  paintCard(c, spec);
  return toCard(canvas, spec.title, spec.code, "png");
}

/** The card as a file: `url` for the screen, `file` for the share sheet. */
export async function toCard(canvas: HTMLCanvasElement, title: string, code: string | null,
                             ext: "png" | "gif", blobIn?: Blob): Promise<MatchCard> {
  const name = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${(code ?? "solo").toLowerCase()}.${ext}`;
  const blob = blobIn ?? await new Promise<Blob | null>((done) => canvas.toBlob(done, "image/png"));
  const type = ext === "gif" ? "image/gif" : "image/png";
  return {
    url: blobIn ? URL.createObjectURL(blobIn) : canvas.toDataURL("image/png"),
    file: new File([blob ?? new Blob([], { type })], name, { type }),
  };
}

/** Paints the whole card onto a 1080² context. Synchronous, so a replay can
    paint it sixty times a second and a GIF encoder can paint it frame by frame. */
export function paintCard(c: Ctx, spec: CardSpec) {
  const { title, code } = spec;

  c.fillStyle = HOT; c.fillRect(0, 0, SIZE, SIZE);

  // The tonal repeat behind everything, lifted straight off the reference boards.
  c.save();
  c.globalAlpha = 0.09; c.fillStyle = "#FFFFFF";
  c.font = `600 132px ${DISPLAY}`;
  c.textAlign = "left"; c.textBaseline = "alphabetic";
  for (let row = 0, y = 120; y < SIZE + 140; y += 128, row++) {
    c.fillText(`${title}  ${title}`, -160 + (row % 2) * 130, y);
  }
  c.restore();

  c.textAlign = "center"; c.textBaseline = "middle";
  star(c, 128, 130, 58, POP);
  star(c, SIZE - 118, 176, 42, POP);

  const hs = fitSize(c, spec.headline, HEADLINE_WIDTH, 92);
  sticker(c, spec.headline, SIZE / 2, 160, hs, POP, 10);

  // the game's picture, clipped to its piece so a hero cannot spill
  piece(c, HERO.x, HERO.y, HERO.w, HERO.h, 44, "#FFFFFF");
  c.save();
  rounded(c, HERO.x + 4, HERO.y + 4, HERO.w - 8, HERO.h - 8, 40); c.clip();
  c.textAlign = "center"; c.textBaseline = "middle";
  spec.hero(c, { x: HERO.x + 32, y: HERO.y + 28, w: HERO.w - 64, h: HERO.h - 56 });
  c.restore();
  c.textAlign = "center"; c.textBaseline = "middle";

  // the score strip: two seats, or the round's one line
  const stripY = 690, stripH = 108;
  if (spec.sides) {
    const [a, b] = spec.sides;
    const winner = a.score === b.score ? null : a.score > b.score ? a : b;
    const w = 430, gap = 20;
    const glyph = spec.glyph ?? markGlyph;
    [a, b].forEach((side, i) => {
      const x = 100 + i * (w + gap);
      piece(c, x, stripY, w, stripH, 34, winner === side ? POP : "#FFFFFF", 12, 7);
      glyph(c, side.mark, x + 62, stripY + stripH / 2, 44);
      c.fillStyle = INK;
      c.textAlign = "left";
      // shrink to 30px, then elide: a name that would run under the score is
      // cut with an ellipsis rather than squeezed into illegibility
      c.font = `600 74px ${DISPLAY}`;
      const room = w - 112 - 30 - c.measureText(String(side.score)).width - 24;
      let name = side.name;
      let size = fitSize(c, name, room, 40);
      while (size < 30 && name.length > 4) { name = ellipsize(name, name.length - 2); size = fitSize(c, name, room, 40); }
      c.font = `600 ${size}px ${DISPLAY}`;
      c.fillText(name, x + 112, stripY + stripH / 2 + 2);
      c.textAlign = "right";
      c.font = `600 74px ${DISPLAY}`;
      c.fillText(String(side.score), x + w - 30, stripY + stripH / 2 + 4);
      c.textAlign = "center";
    });
  } else {
    piece(c, 100, stripY, 880, stripH, 34, POP, 12, 7);
    c.fillStyle = INK;
    c.font = `600 ${fitSize(c, spec.caption ?? "", 820, 48)}px ${DISPLAY}`;
    c.fillText(spec.caption ?? "", SIZE / 2, stripY + stripH / 2 + 2);
  }

  // the footer: the caption when the game has one, then where and when
  piece(c, 100, 840, 880, 96, 32, "#FFFFFF", 10, 7);
  const where = spec.where ?? (code ? `ROOM ${code}` : spec.sides ? "SOLO v THE BOT" : "SOLO ROUND");
  const date = new Date().toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
  const withSides = !!spec.sides && !!spec.caption;
  c.fillStyle = INK;
  c.font = `800 ${fitSize(c, withSides ? spec.caption! : where, 800, 26, 800, BODY)}px ${BODY}`;
  c.fillText(withSides ? spec.caption! : where, SIZE / 2, 872);
  c.fillStyle = SOFT;
  c.font = `700 23px ${BODY}`;
  c.fillText(withSides ? `${where} · ${date}` : date, SIZE / 2, 908);

  sticker(c, "BoredGame", SIZE / 2, 1004, 54, "#FFFFFF", 8);
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

/**
 * A session card shows the GAME, not a board: the same picture every time
 * for that game, so it is recognisable in a group chat at thumbnail size.
 * These two are what every artwork hero is built from — the game's name as
 * a sticker along the bottom of the panel, and a slightly tilted stage above
 * it for the drawing, the tilt being what says "illustration" rather than
 * "screenshot of a board".
 */
export function artStage(c: Ctx, box: Box, name: string, tilt: number,
                         draw: (c: Ctx, w: number, h: number) => void) {
  const nameH = 74;
  sticker(c, name, box.x + box.w / 2, box.y + box.h - nameH / 2 + 6, 56, POP, 7);
  const stage = { w: box.w, h: box.h - nameH - 8 };
  c.save();
  c.translate(box.x + stage.w / 2, box.y + stage.h / 2);
  c.rotate((tilt * Math.PI) / 180);
  draw(c, stage.w, stage.h);
  c.restore();
}
