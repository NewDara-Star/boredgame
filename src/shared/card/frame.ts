/**
 * The result card you can actually keep — the six-part card from the show-off kit
 * (project doc boredgame/SHARING.md):
 *
 *   1 world   the game family's colour, lit from the top, with the seed spiral
 *   2 hook    what happened, in the sender's words ("I beat Tobi 3–1")
 *   3 moment  a white cut plate with the real result drawn in the chunky style,
 *             and the sunflower reacting from the corner
 *   4 detail  both players with their scores, or one line of context
 *   5 dare    the darkest thing on the card: a question for whoever sees it, and
 *             the code or date to get in
 *   6 name    the wordmark, small
 *
 * Drawn straight onto a canvas rather than screenshotting the DOM: no extra
 * dependency, no html2canvas guessing at CSS, and it comes out at a fixed size
 * whatever phone it was played on. Square (1080×1080) for chats, story
 * (1080×1920) for Instagram / TikTok / WhatsApp status.
 *
 * paintCard is synchronous so a replay can paint it sixty times a second and a GIF
 * encoder frame by frame; the pictures it needs (the flower, the wordmark) are
 * loaded once by cardAssetsReady(), which drawCard awaits.
 */
import type { Mark } from "@/features/squareoff/rules";
import { artRaw } from "@/shared/brand/Art";
import { BOARD, FAMILIES, FONT, INK, RAMPS, type Family, type Ramp } from "@/shared/brand/tokens";
import { SEAT_RAMP } from "@/shared/brand/seats";
import type { FlowerState } from "@/shared/brand/Sunflower";

export const SIZE = 1080;
export const STORY_H = 1920;
export { INK };
export const DISPLAY = FONT.display;
export const BODY = FONT.text;
export const MONO = FONT.mono;

export type Ctx = CanvasRenderingContext2D;
export interface Box { x: number; y: number; w: number; h: number }
export type Hero = (c: Ctx, box: Box) => void;
export type Glyph = (c: Ctx, mark: Mark, cx: number, cy: number, s: number) => void;

// ------------------------------------------------------------------ geometry
export function rounded(c: Ctx, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}
const octPts = (x: number, y: number, w: number, h: number, k: number): [number, number][] =>
  [[x + k, y], [x + w - k, y], [x + w, y + k], [x + w, y + h - k], [x + w - k, y + h], [x + k, y + h], [x, y + h - k], [x, y + k]];
const poly = (c: Ctx, pts: [number, number][]) => {
  c.beginPath(); pts.forEach(([a, b], i) => (i ? c.lineTo(a, b) : c.moveTo(a, b))); c.closePath();
};

const WHITE: Ramp = { hi: BOARD, base: BOARD, lo: "#E3E9F5", deep: "#C9D3E6" }; // brand-ok: plane shades of white
const INKR: Ramp = { hi: "#4A4466", base: INK, lo: "#170F2C", deep: "#0B0718" };  // brand-ok: plane shades of ink

/** A cut plate: an octagon, four bevel planes lit from the top left, a flat face,
    on a soft shadow. No outline — plates are the world, not subjects. */
export function cutPlate(c: Ctx, x: number, y: number, w: number, h: number, k: number, bev: number, r: Ramp, shadow = true) {
  const O = octPts(x, y, w, h, k), I = octPts(x + bev, y + bev, w - 2 * bev, h - 2 * bev, Math.max(k - bev * 0.6, 4));
  if (shadow) {
    c.save(); c.shadowColor = "rgba(11,24,80,.28)"; c.shadowBlur = 30; c.shadowOffsetY = 14;
    poly(c, O); c.fillStyle = r.base; c.fill(); c.restore();
  }
  const tones = [r.hi, r.hi, r.base, r.lo, r.deep, r.lo, r.base, r.hi];
  for (let i = 0; i < 8; i++) {
    const j = (i + 1) % 8;
    poly(c, [O[i], O[j], I[j], I[i]]); c.fillStyle = tones[i]; c.fill();
  }
  poly(c, I); c.fillStyle = r.base; c.fill();
}

/** Outline and hard shadow for a subject: draw its path, and this strokes the ink
    under it, fills it, and adds a glint. */
export function subject(c: Ctx, path: () => void, fill: string | CanvasGradient, ow = 7, drop = 7) {
  c.save(); c.lineJoin = "round"; c.lineCap = "round";
  c.translate(0, drop); path(); c.lineWidth = ow * 2; c.strokeStyle = INK; c.stroke(); c.fillStyle = INK; c.fill();
  c.translate(0, -drop); path(); c.stroke(); c.fill();
  path(); c.fillStyle = fill; c.fill();
  c.restore();
}
/** A stroked subject (a ring, a cross, a winning line): ink under, colour over. */
export function subjectStroke(c: Ctx, path: () => void, colour: string, width: number, ow = 7, drop = 7) {
  c.save(); c.lineCap = "round"; c.lineJoin = "round"; c.strokeStyle = INK; c.lineWidth = width + ow * 2;
  c.translate(0, drop); path(); c.stroke(); c.translate(0, -drop); path(); c.stroke();
  c.strokeStyle = colour; c.lineWidth = width; path(); c.stroke();
  c.restore();
}
export function glint(c: Ctx, x: number, y: number, rx: number, rot = -0.6) {
  c.save(); c.translate(x, y); c.rotate(rot); c.beginPath(); c.ellipse(0, 0, rx, rx * 0.55, 0, 0, Math.PI * 2);
  c.fillStyle = "rgba(255,255,255,.85)"; c.fill(); c.restore();
}
/** A ball lit from the top left, outlined. Seats, answers, discs. */
export function ball(c: Ctx, cx: number, cy: number, r: number, ramp: Ramp) {
  const g = c.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r * 1.05);
  g.addColorStop(0, ramp.hi); g.addColorStop(0.55, ramp.base); g.addColorStop(1, ramp.lo);
  subject(c, () => { c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); }, g, Math.max(3, r * 0.1), Math.max(3, r * 0.12));
  glint(c, cx - r * 0.38, cy - r * 0.42, r * 0.22);
}

/** The seed spiral: each seed 137.5° round from the last, radius growing with √k. */
function spiral(c: Ctx, cx: number, cy: number, n: number, spread: number, rmin: number, rmax: number, alpha: number) {
  c.save(); c.fillStyle = `rgba(255,255,255,${alpha})`;
  for (let k = 1; k <= n; k++) {
    const a = k * 2.39996, r = spread * Math.sqrt(k), d = rmin + ((rmax - rmin) * k) / n;
    c.beginPath(); c.arc(cx + r * Math.cos(a), cy + r * Math.sin(a), d, 0, Math.PI * 2); c.fill();
  }
  c.restore();
}
function world(c: Ctx, w: number, h: number, ramp: Ramp, sx: number, sy: number) {
  const g = c.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, ramp.hi); g.addColorStop(0.5, ramp.base); g.addColorStop(1, ramp.lo);
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  spiral(c, sx, sy, 420, w * 0.036, 2, 13, 0.24);
}

// ------------------------------------------------------------------ type
/** Shrinks the type until the text fits rather than letting it run off the card. */
export function fitSize(c: Ctx, text: string, max: number, start: number, weight = 400, family: string = DISPLAY) {
  let size = start;
  do { c.font = `${weight} ${size}px ${family}`; size -= 2; } while (c.measureText(text).width > max && size > 20);
  return size + 2;
}
export const ellipsize = (text: string, n: number) =>
  text.length <= n ? text : `${text.slice(0, n - 1).trimEnd()}…`;

// ------------------------------------------------------------------ pictures
const IMAGES = new Map<string, HTMLImageElement>();
function svgImage(key: string, svg: string) {
  if (IMAGES.has(key) || !svg) return Promise.resolve();
  const vb = /viewBox="([^"]+)"/.exec(svg)?.[1].split(/\s+/).map(Number) ?? [0, 0, 100, 100];
  const sized = svg.replace("<svg ", `<svg width="${vb[2] * 4}" height="${vb[3] * 4}" `);
  const img = new Image();
  IMAGES.set(key, img);
  return new Promise<void>((done) => {
    img.onload = () => done(); img.onerror = () => { IMAGES.delete(key); done(); };
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(sized)}`;
  });
}
const FLOWERS: FlowerState[] = ["bloom", "bored", "awake", "look-left", "look-right", "sleep"];
/** Waits for the card's fonts and pictures, once. Without it the first card of a
    session comes out in the fallback face with no flower. */
export async function cardAssetsReady() {
  if (document.fonts?.ready) { try { await document.fonts.ready; } catch { /* older browsers */ } }
  await Promise.all([
    ...FLOWERS.map((f) => svgImage(`sf-${f}`, artRaw(`sf-${f}`))),
    svgImage("wordmark", artRaw("wordmark-ink")),
    svgImage("streak", artRaw("streak")),
  ]);
}
/** Kept for the Ball Sort replay, which calls it before painting frames. */
export const fontsReady = cardAssetsReady;
export async function badgeImage(key: string, viewBox: string, paths: string) {
  await svgImage(`badge-${key}`, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${paths}</svg>`);
  return IMAGES.get(`badge-${key}`) ?? null;
}
/** A loaded picture, for heroes that draw one (the streak flame). */
export const cardImage = (key: string) => IMAGES.get(key) ?? null;
function drawImage(c: Ctx, key: string, x: number, y: number, w: number) {
  const img = IMAGES.get(key);
  if (!img || !img.naturalWidth) return 0;
  const h = (w * img.naturalHeight) / img.naturalWidth;
  c.drawImage(img, x, y, w, h);
  return h;
}

// ------------------------------------------------------------------ the card
export interface Side { name: string; score: number; mark: Mark }

export interface CardSpec {
  /** the game's name — also the file's name, and how the family is found */
  title: string;
  /** the game family, which sets the world colour; found from the title if left out */
  family?: Family;
  /** a world colour that isn't a family: gold for a rank, ember for a streak */
  ramp?: Ramp;
  /** the hook: what happened, in the sender's words */
  headline: string;
  /** the game's real result, drawn into the plate */
  hero: Hero;
  /** the two seats and their scores; a solo round has none */
  sides?: [Side, Side];
  /** kept for callers that pass one; seats are drawn as player discs now */
  glyph?: Glyph;
  /** one line of context for a solo card ("Solved in 22 · par 21") */
  caption?: string;
  /** names the file; a finished room can't be joined, so it is not printed */
  code: string | null;
  /** a code the viewer can actually use to get in (an open room); printed on the dare */
  join?: string;
  /** what goes out with the image, and where its link lands (a path in the app) */
  text?: string;
  path?: string;
  /** the footer's line when it is not a room: "Today's round · 24 Sep" */
  where?: string;
  /** the dare, aimed at whoever sees the card */
  dare?: string;
  /** how the flower reacts; bloom unless said otherwise */
  flower?: FlowerState;
  /** under the hook, on a story */
  sub?: string;
}

/** `url` is for putting it on screen, `file` for the share sheet, `story` the tall one.
    The files are built up front on purpose: see shareResult(). */
export interface MatchCard { url: string; file: File; story?: File; text?: string; link?: string }

const FAMILY_OF: Record<string, Family> = {
  "picto phrase": "quiz", "star trivia": "quiz", "trivia": "quiz", "daily": "quiz", "today's round": "quiz",
  "square off": "board", "tic tac toe": "board", "connect 4": "board", "connect 4 trivia": "board",
  "memory match": "puzzle", "ball sort": "puzzle", "catapult squares": "skill", "connect 4 catapult": "skill",
};
const rampFor = (spec: CardSpec): Ramp => spec.ramp ??
  RAMPS[FAMILIES[spec.family ?? FAMILY_OF[spec.title.toLowerCase()] ?? "board"]];

function hook(c: Ctx, text: string, cx: number, y: number, max: number, start: number) {
  c.fillStyle = INK; c.textAlign = "center"; c.textBaseline = "middle";
  c.font = `400 ${fitSize(c, text, max, start)}px ${DISPLAY}`;
  c.fillText(text, cx, y);
}
function seatChip(c: Ctx, x: number, y: number, w: number, h: number, side: Side, won: boolean) {
  cutPlate(c, x, y, w, h, 24, 10, won ? RAMPS.petal : WHITE, true);
  const r = h * 0.28, cx = x + 30 + r, cy = y + h / 2 - 2;
  ball(c, cx, cy, r, SEAT_RAMP[side.mark]);
  c.fillStyle = INK; c.textAlign = "center"; c.textBaseline = "middle";
  c.font = `400 ${r * 1.05}px ${DISPLAY}`; c.fillText((side.name.trim()[0] ?? "?").toUpperCase(), cx, cy + 2);
  c.textAlign = "right"; c.font = `400 64px ${DISPLAY}`;
  const scoreW = c.measureText(String(side.score)).width;
  c.fillText(String(side.score), x + w - 30, cy + 4);
  c.textAlign = "left";
  const room = w - (cx + r + 16 - x) - scoreW - 50;
  let name = side.name; let size = fitSize(c, name, room, 40, 400, DISPLAY);
  while (size < 26 && name.length > 4) { name = ellipsize(name, name.length - 2); size = fitSize(c, name, room, 40, 400, DISPLAY); }
  c.font = `400 ${size}px ${DISPLAY}`; c.fillText(name, cx + r + 16, cy + 3);
}
function paintDare(c: Ctx, x: number, y: number, w: number, h: number, text: string, code: string | null, hint: string | null) {
  cutPlate(c, x, y, w, h, 26, 10, INKR, true);
  c.textBaseline = "middle"; c.textAlign = "left"; c.fillStyle = BOARD;
  const right = code ? Math.min(420, w * 0.44) : 0;
  c.font = `400 ${fitSize(c, text, w - right - 90, 54)}px ${DISPLAY}`;
  c.fillText(text, x + 50, y + h / 2 + 2);
  if (code) {
    c.textAlign = "right"; c.fillStyle = RAMPS.petal.base;
    c.font = `700 ${fitSize(c, code, right, 42, 700, MONO)}px ${MONO}`;
    c.fillText(code, x + w - 50, y + h / 2 - (hint ? 14 : 0));
    if (hint) { c.fillStyle = "rgba(255,255,255,.7)"; c.font = `700 24px ${BODY}`; c.fillText(hint, x + w - 50, y + h / 2 + 30); }
  }
}

/** Paints the square card onto a 1080² context. Synchronous (see the header). */
export function paintCard(c: Ctx, spec: CardSpec) {
  const ramp = rampFor(spec);
  c.save();
  world(c, SIZE, SIZE, ramp, 540, 470);
  hook(c, spec.headline, 540, 142, 940, 80);
  cutPlate(c, 90, 196, 900, 476, 34, 13, WHITE);
  c.save(); rounded(c, 104, 210, 872, 448, 20); c.clip();
  spec.hero(c, { x: 150, y: 232, w: 720, h: 404 });
  c.restore();
  drawImage(c, `sf-${spec.flower ?? "bloom"}`, 812, 462, 230);
  if (spec.sides) {
    const [a, b] = spec.sides; const win = a.score === b.score ? null : a.score > b.score ? a : b;
    seatChip(c, 90, 704, 440, 118, a, win === a);
    seatChip(c, 550, 704, 440, 118, b, win === b);
  } else {
    cutPlate(c, 90, 704, 900, 118, 24, 10, WHITE);
    c.fillStyle = INK; c.textAlign = "center"; c.textBaseline = "middle";
    const line = spec.caption ?? spec.where ?? spec.title;
    c.font = `400 ${fitSize(c, line, 820, 42)}px ${DISPLAY}`; c.fillText(line, 540, 765);
  }
  paintDare(c, 90, 846, 900, 136, spec.dare ?? (spec.join ? "Your move?" : "Beat that?"),
    spec.join ?? null, spec.join ? "the code to get in" : null);
  drawImage(c, "wordmark", 430, 1004, 220);
  c.restore();
}

/** The same card, tall, for stories. The top 250 and bottom 340 px stay clear of the
    apps' own buttons. */
export function paintStory(c: Ctx, spec: CardSpec) {
  const ramp = rampFor(spec);
  c.save();
  world(c, SIZE, STORY_H, ramp, 540, 820);
  const hill = c.createLinearGradient(0, 1460, 0, 1920);
  hill.addColorStop(0, RAMPS.leaf.hi); hill.addColorStop(1, RAMPS.leaf.base);
  c.beginPath(); c.ellipse(540, 1900, 900, 440, 0, 0, Math.PI * 2); c.fillStyle = hill; c.fill();
  hook(c, spec.headline, 540, 350, 960, 88);
  if (spec.sub) { c.font = `700 40px ${BODY}`; c.fillText(spec.sub, 540, 432); }
  cutPlate(c, 110, 490, 860, 650, 40, 15, WHITE);
  c.save(); rounded(c, 126, 506, 828, 618, 22); c.clip();
  spec.hero(c, { x: 170, y: 540, w: 740, h: 560 });
  c.restore();
  drawImage(c, `sf-${spec.flower ?? "bloom"}`, 410, 1140, 260);
  paintDare(c, 110, 1490, 860, 170, spec.dare ?? (spec.join ? "Your move?" : "Beat that?"), spec.join ?? "play free", null);
  drawImage(c, "wordmark", 400, 1700, 280);
  c.restore();
}

const fileName = (title: string, code: string | null, ext: string, tall = false) =>
  `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${(code ?? "solo").toLowerCase().replace(/[^a-z0-9]+/g, "")}${tall ? "-story" : ""}.${ext}`;

async function canvasFile(w: number, h: number, paint: (c: Ctx) => void, name: string) {
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const c = canvas.getContext("2d");
  if (!c) throw new Error("canvas unavailable");
  paint(c);
  const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, "image/png"));
  return { canvas, file: new File([blob ?? new Blob([], { type: "image/png" })], name, { type: "image/png" }) };
}

const words = (spec: CardSpec) => ({
  text: spec.text ?? `${spec.headline}. ${spec.dare ?? "Beat that?"}`,
  link: (typeof location === "undefined" ? "" : location.origin) + (spec.path ?? "/play"),
});

/** Both cuts of the card, square and story, drawn after the pictures are in. */
export async function drawCard(spec: CardSpec): Promise<MatchCard> {
  await cardAssetsReady();
  const sq = await canvasFile(SIZE, SIZE, (c) => paintCard(c, spec), fileName(spec.title, spec.code, "png"));
  const st = await canvasFile(SIZE, STORY_H, (c) => paintStory(c, spec), fileName(spec.title, spec.code, "png", true));
  return { url: sq.canvas.toDataURL("image/png"), file: sq.file, story: st.file, ...words(spec) };
}

/** A story-only card (rank up, streak) with its own middle. */
export async function drawStory(spec: CardSpec): Promise<MatchCard> {
  await cardAssetsReady();
  const st = await canvasFile(SIZE, STORY_H, (c) => paintStory(c, spec), fileName(spec.title, spec.code, "png", true));
  return { url: st.canvas.toDataURL("image/png"), file: st.file, story: st.file, ...words(spec) };
}

/** The card as a file from an already painted canvas (the Ball Sort GIF). */
export async function toCard(canvas: HTMLCanvasElement, title: string, code: string | null,
                             ext: "png" | "gif", blobIn?: Blob): Promise<MatchCard> {
  const name = fileName(title, code, ext);
  const blob = blobIn ?? await new Promise<Blob | null>((done) => canvas.toBlob(done, "image/png"));
  const type = ext === "gif" ? "image/gif" : "image/png";
  return {
    url: blobIn ? URL.createObjectURL(blobIn) : canvas.toDataURL("image/png"),
    file: new File([blob ?? new Blob([], { type })], name, { type }),
  };
}

export { shareResult } from "./share";
