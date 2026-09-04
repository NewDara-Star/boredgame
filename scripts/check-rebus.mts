/**
 * Quality gate for rebus puzzles.
 *
 *   node --experimental-strip-types scripts/check-rebus.mts
 *
 * Catches the two failure modes that actually happen:
 *   1. the visual is wrong — words overlap, run off the canvas, or are too
 *      small to read. Eleven of the first 36 puzzles shipped with colliding
 *      text because nothing checked this.
 *   2. the puzzle doesn't work — the answer is spelled out on the canvas, the
 *      hints are placeholder, or two puzzles share an answer.
 *
 * Geometry is estimated, not measured: SVG text width depends on font metrics
 * the renderer doesn't expose. So this flags suspects for a human to look at —
 * it is a filter, not a judge. Always eyeball the contact sheet as well.
 */
import type { RebusItem } from "../src/shared/types/db.ts";
import { PICTO_SEED } from "../src/shared/data/picto.ts";

import { textWidth } from "./layout.mts";
const MIN_SIZE = 5;
const CANVAS = 100;

interface Box { x0: number; y0: number; x1: number; y1: number }

function boxOf(it: RebusItem): Box {
  const size = it.size ?? 14;
  const w = it.w ?? textWidth(it.text, size);
  const h = size * 0.82;
  // A rotated item sweeps a larger area; approximate with the rotated AABB.
  const rad = ((it.rotate ?? 0) * Math.PI) / 180;
  const c = Math.abs(Math.cos(rad)), s = Math.abs(Math.sin(rad));
  const rw = w * c + h * s;
  const rh = w * s + h * c;
  return { x0: it.x - rw / 2, y0: it.y - rh / 2, x1: it.x + rw / 2, y1: it.y + rh / 2 };
}

const overlapArea = (a: Box, b: Box) =>
  Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) *
  Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));

const areaOf = (b: Box) => (b.x1 - b.x0) * (b.y1 - b.y0);
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export interface Issue { slug: string; level: "fail" | "warn"; message: string }

export function checkPuzzle(
  p: { slug: string; items: RebusItem[]; answer: string; alt_hint: string; char_hint: string },
  seenAnswers = new Set<string>()
): Issue[] {
  const out: Issue[] = [];
  const add = (level: Issue["level"], message: string) => out.push({ slug: p.slug, level, message });

  if (p.items.length === 0) add("fail", "no items on the canvas");

  const boxes = p.items.map(boxOf);

  p.items.forEach((it, i) => {
    const b = boxes[i];
    if (!it.text.trim()) add("fail", `item ${i} has no text`);
    if ((it.size ?? 14) < MIN_SIZE) add("warn", `item ${i} ("${it.text}") is size ${it.size}, likely unreadable`);
    if (b.x0 < -1 || b.x1 > CANVAS + 1)
      add("fail", `item ${i} ("${it.text}") runs off horizontally: ${b.x0.toFixed(0)}..${b.x1.toFixed(0)}`);
    if (b.y0 < -1 || b.y1 > CANVAS + 1)
      add("fail", `item ${i} ("${it.text}") runs off vertically: ${b.y0.toFixed(0)}..${b.y1.toFixed(0)}`);
    // A declared width far from the natural one stretches or squashes glyphs.
    // The first batch of generated puzzles shipped "B 4" and "X L" visibly
    // distorted because nothing compared the two.
    if (it.w !== undefined && it.text.trim()) {
      const natural = textWidth(it.text, it.size ?? 14);
      const ratio = it.w / natural;
      if (ratio > 1.3 || ratio < 0.72)
        add("warn", `item ${i} ("${it.text}") is set to w=${it.w.toFixed(0)} against a natural ${natural.toFixed(0)} — glyphs will be ${ratio > 1 ? "stretched" : "squashed"}`);
    }
    // Anything sharing a row without a declared width is guesswork.
    const sharesRow = p.items.some((o, j) => j !== i && Math.abs((o.y ?? 50) - it.y) < (it.size ?? 14) * 0.7);
    if (sharesRow && it.w === undefined)
      add("warn", `item ${i} ("${it.text}") shares a row but has no w — layout depends on font metrics`);
  });

  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const ov = overlapArea(boxes[i], boxes[j]);
      const frac = ov / Math.min(areaOf(boxes[i]), areaOf(boxes[j]));
      if (frac > 0.12)
        add("fail", `"${p.items[i].text}" and "${p.items[j].text}" overlap by ${Math.round(frac * 100)}%`);
      else if (frac > 0.02)
        add("warn", `"${p.items[i].text}" and "${p.items[j].text}" touch (${Math.round(frac * 100)}%)`);
    }
  }

  // A rebus that spells its own answer is not a rebus.
  const canvasText = norm(p.items.map((i) => i.text).join(""));
  const answer = norm(p.answer);
  if (answer.length > 3 && canvasText.includes(answer))
    add("fail", `the canvas spells the answer outright ("${p.answer}")`);

  if (answer.length < 2) add("fail", "answer is too short");
  if (p.alt_hint.trim().length < 8) add("fail", "description hint is missing or too short");
  if (p.char_hint.trim().length < 3) add("fail", "character hint is missing or too short");
  if (/^(.)\1*$/.test(norm(p.alt_hint))) add("fail", "description hint is placeholder text");

  if (seenAnswers.has(answer)) add("fail", `duplicate answer — "${p.answer}" already exists`);
  seenAnswers.add(answer);

  return out;
}

// ---- CLI entry point ----
// Guarded: this module is also imported by other scripts, and an unguarded
// report meant importing it silently re-ran the wrong check.
const isEntry = process.argv[1]?.endsWith("check-rebus.mts");
if (isEntry) {
const seen = new Set<string>();
const all = PICTO_SEED.flatMap((p) => checkPuzzle(p, seen));
const fails = all.filter((i) => i.level === "fail");
const warns = all.filter((i) => i.level === "warn");

for (const i of [...fails, ...warns]) {
  console.log(`${i.level === "fail" ? "FAIL" : "warn"}  ${i.slug.padEnd(28)} ${i.message}`);
}
console.log(`\n${PICTO_SEED.length} puzzles · ${fails.length} failures · ${warns.length} warnings`);
process.exit(fails.length ? 1 : 0);
}
