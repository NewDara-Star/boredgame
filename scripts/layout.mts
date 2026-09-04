/**
 * Layout helpers for rebus specs.
 *
 * Hand-computed x/w is what produced eleven colliding puzzles in the first
 * batch. These tile the canvas arithmetically, so overlap is impossible by
 * construction rather than caught afterwards by the gate.
 */
import type { RebusItem } from "../src/shared/types/db.ts";

/**
 * Per-character widths, as a fraction of font size, for bold uppercase sans.
 *
 * A flat average fails badly at the extremes: a lone "I" given the average
 * width gets stretched by textLength into a solid bar, which is exactly how
 * "I C U" first rendered. M and W need the opposite correction.
 */
const NARROW = 0.30, WIDE = 0.88, DEFAULT = 0.62;
const CHAR_W_TABLE: Record<string, number> = {
  I: NARROW, J: 0.40, L: 0.55, T: 0.58, " ": NARROW, ".": 0.28, "'": 0.24,
  M: WIDE, W: WIDE, "1": 0.40,
};
const charW = (c: string) => CHAR_W_TABLE[c] ?? DEFAULT;

/** Estimated rendered width of a string at a given font size. */
export const textWidth = (text: string, size: number) =>
  size * [...text].reduce((n, c) => n + charW(c), 0);

const CANVAS = 100;

/**
 * A horizontal sequence at natural width, centred as a group.
 *
 * An earlier version divided the canvas proportionally, which gave a
 * one-character item the same slot share as its neighbours and left
 * lengthAdjust stretching the glyphs sideways. "B 4" and "X L" came out
 * visibly distorted. Widths are now derived from the text itself and the
 * leftover space becomes margin, not stretch.
 */
export function row(
  texts: string[],
  opts: { y?: number; gap?: number; maxSize?: number; extra?: Partial<RebusItem>[] } = {}
): RebusItem[] {
  const { y = 50, gap = 7, maxSize = 17, extra = [] } = opts;
  const gaps = gap * (texts.length - 1);
  const unit = texts.reduce((n, t) => n + textWidth(t, 1), 0);
  const size = Math.min(maxSize, (90 - gaps) / unit);
  const widths = texts.map((t) => textWidth(t, size));
  const total = widths.reduce((a, b) => a + b, 0) + gaps;
  let cursor = (CANVAS - total) / 2;
  return texts.map((text, i) => {
    const w = widths[i];
    const item: RebusItem = {
      text,
      x: +(cursor + w / 2).toFixed(1),
      y,
      size: +size.toFixed(1),
      w: +w.toFixed(1),
      ...extra[i],
    };
    cursor += w + gap;
    return item;
  });
}

/** Two or three items stacked vertically, each centred. */
export function stack(texts: string[], opts: { maxSize?: number; extra?: Partial<RebusItem>[] } = {}): RebusItem[] {
  const { maxSize = 15, extra = [] } = opts;
  const ys = texts.length === 2 ? [34, 66] : texts.length === 3 ? [24, 50, 76] : [50];
  return texts.map((text, i) => {
    const size = Math.min(maxSize, 88 / textWidth(text, 1));
    return {
      text, x: 50, y: ys[i],
      size: +size.toFixed(1),
      w: +textWidth(text, size).toFixed(1),
      ...extra[i],
    } as RebusItem;
  });
}

/** One item, centred, sized to fill the canvas width. */
export function solo(text: string, opts: Partial<RebusItem> & { maxSize?: number } = {}): RebusItem[] {
  const { maxSize = 20, ...rest } = opts;
  const size = Math.min(maxSize, 88 / textWidth(text, 1));
  return [{
    text, x: 50, y: 50,
    size: +size.toFixed(1),
    w: +textWidth(text, size).toFixed(1),
    ...rest,
  } as RebusItem];
}
