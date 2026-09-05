/**
 * A GIF writer, because a film of a solve has to reach a group chat, and the
 * only moving picture every chat app plays without asking the browser for a
 * codec is a GIF. Written here rather than imported: it is a palette, an LZW
 * coder and a handful of headers, and owning it means knowing why a frame is
 * the size it is.
 *
 * One palette for the whole clip (median cut over the first frame, which has
 * every colour the card will use) so nothing flickers between frames, and
 * only the pixels that changed are written — the rest are transparent over
 * the previous frame — so a card that is mostly still stays small.
 */

export interface GifJob {
  width: number; height: number;
  /** frames per second; GIF timing is in centiseconds, so 10, 20, 25 or 50 are exact */
  fps: number;
  /** the frame at `i`, or null when the film is over */
  frame: (i: number) => ImageData | null;
  onProgress?: (done: number) => void;
}

const TRANSPARENT = 255;

/** Median cut over the colours present, to at most 255 entries. */
function palette(px: Uint8ClampedArray): Uint8Array {
  const seen = new Map<number, number>();
  for (let i = 0; i < px.length; i += 4) {
    const key = (px[i] << 16) | (px[i + 1] << 8) | px[i + 2];
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  type Box = { colours: number[]; count: number };
  let boxes: Box[] = [{ colours: [...seen.keys()], count: 0 }];
  const range = (b: Box) => {
    let lo = [255, 255, 255], hi = [0, 0, 0];
    for (const k of b.colours) {
      const ch = [k >> 16, (k >> 8) & 255, k & 255];
      for (let c = 0; c < 3; c++) { if (ch[c] < lo[c]) lo[c] = ch[c]; if (ch[c] > hi[c]) hi[c] = ch[c]; }
    }
    const spans = [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]];
    const axis = spans.indexOf(Math.max(...spans));
    return { span: spans[axis], axis };
  };
  while (boxes.length < 255) {
    let best = -1, bestSpan = 0;
    boxes.forEach((b, i) => { if (b.colours.length < 2) return; const r = range(b); if (r.span > bestSpan) { bestSpan = r.span; best = i; } });
    if (best < 0) break;
    const b = boxes[best], { axis } = range(b);
    const shift = axis === 0 ? 16 : axis === 1 ? 8 : 0;
    b.colours.sort((p, q) => ((p >> shift) & 255) - ((q >> shift) & 255));
    // split at the weighted median, so a box full of one popular colour
    // does not spend its split on the tail
    // — and if the popular colour sorts last, the median IS the last entry,
    // so it gets a box to itself rather than the first shade being peeled
    // off one at a time (which is what filled a palette with 250 greens)
    const total = b.colours.reduce((s, k) => s + seen.get(k)!, 0);
    let acc = 0, cut = b.colours.length - 1;
    for (let i = 0; i < b.colours.length - 1; i++) { acc += seen.get(b.colours[i])!; if (acc >= total / 2) { cut = i + 1; break; } }
    boxes.splice(best, 1, { colours: b.colours.slice(0, cut), count: 0 }, { colours: b.colours.slice(cut), count: 0 });
  }
  const out = new Uint8Array(256 * 3);
  boxes.forEach((b, i) => {
    let r = 0, g = 0, bl = 0, n = 0;
    for (const k of b.colours) { const w = seen.get(k)!; r += (k >> 16) * w; g += ((k >> 8) & 255) * w; bl += (k & 255) * w; n += w; }
    out[i * 3] = Math.round(r / n); out[i * 3 + 1] = Math.round(g / n); out[i * 3 + 2] = Math.round(bl / n);
  });
  return out;
}

/** Nearest palette entry, memoised: a card has a few thousand distinct
    colours and a few hundred thousand pixels a frame. */
function mapper(pal: Uint8Array, entries: number) {
  const cache = new Map<number, number>();
  return (r: number, g: number, b: number) => {
    const key = (r << 16) | (g << 8) | b;
    const hit = cache.get(key);
    if (hit !== undefined) return hit;
    let best = 0, bestD = Infinity;
    for (let i = 0; i < entries; i++) {
      const dr = r - pal[i * 3], dg = g - pal[i * 3 + 1], db = b - pal[i * 3 + 2];
      const d = dr * dr + dg * dg + db * db;
      if (d < bestD) { bestD = d; best = i; }
    }
    cache.set(key, best);
    return best;
  };
}

/** GIF's LZW, variable code width, 8-bit minimum. Emits sub-blocks. */
function lzw(indices: Uint8Array, out: number[]) {
  const MIN = 8, CLEAR = 1 << MIN, EOI = CLEAR + 1;
  out.push(MIN);
  let block: number[] = [];
  let bitBuf = 0, bitLen = 0;
  const emit = (code: number, width: number) => {
    bitBuf |= code << bitLen; bitLen += width;
    while (bitLen >= 8) {
      block.push(bitBuf & 255); bitBuf >>>= 8; bitLen -= 8;
      if (block.length === 255) { out.push(255, ...block); block = []; }
    }
  };
  let dict = new Map<number, number>();
  let next = EOI + 1, width = MIN + 1;
  emit(CLEAR, width);
  let prefix = indices[0];
  for (let i = 1; i < indices.length; i++) {
    const k = indices[i];
    const key = (prefix << 8) | k;
    const found = dict.get(key);
    if (found !== undefined) { prefix = found; continue; }
    emit(prefix, width);
    if (next < 4096) {
      // the decoder adds its entry one code behind us, so it widens one
      // code later than we would by counting our own: widen when the entry
      // about to be added is the first that would not fit
      if (next >= 1 << width && width < 12) width++;
      dict.set(key, next++);
    } else {
      emit(CLEAR, width);
      dict = new Map(); next = EOI + 1; width = MIN + 1;
    }
    prefix = k;
  }
  emit(prefix, width);
  emit(EOI, width);
  if (bitLen > 0) block.push(bitBuf & 255);
  if (block.length) out.push(block.length, ...block);
  out.push(0);
}

const u16 = (out: number[], v: number) => { out.push(v & 255, (v >> 8) & 255); };

export async function encodeGif(job: GifJob): Promise<Blob> {
  const { width, height } = job;
  const delay = Math.round(100 / job.fps);
  const first = job.frame(0);
  if (!first) throw new Error("no frames");
  const pal = palette(first.data);
  const nearest = mapper(pal, 255);
  const chunks: Uint8Array[] = [];
  const head: number[] = [];
  head.push(...[0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);                    // GIF89a
  u16(head, width); u16(head, height);
  head.push(0xF7, 0, 0);                                                  // global table, 256 entries
  head.push(...pal);
  head.push(0x21, 0xFF, 0x0B, ...[0x4E,0x45,0x54,0x53,0x43,0x41,0x50,0x45,0x32,0x2E,0x30], 3, 1, 0, 0, 0); // loop forever
  chunks.push(Uint8Array.from(head));

  let prev: Uint8Array | null = null;
  for (let i = 0; ; i++) {
    const img = i === 0 ? first : job.frame(i);
    if (!img) break;
    const px = img.data, n = width * height;
    const idx = new Uint8Array(n);
    for (let p = 0; p < n; p++) idx[p] = nearest(px[p * 4], px[p * 4 + 1], px[p * 4 + 2]);
    // only what changed: everything else is transparent over the last frame
    const out = new Uint8Array(n);
    if (prev) { for (let p = 0; p < n; p++) out[p] = idx[p] === prev[p] ? TRANSPARENT : idx[p]; }
    else out.set(idx);
    prev = idx;
    const f: number[] = [];
    // graphic control: disposal 1 (leave the frame in place), transparency
    // on from the second frame so untouched pixels show through
    f.push(0x21, 0xF9, 4, i > 0 ? 0x05 : 0x04, delay & 255, (delay >> 8) & 255, TRANSPARENT, 0);
    f.push(0x2C); u16(f, 0); u16(f, 0); u16(f, width); u16(f, height); f.push(0);
    lzw(out, f);
    chunks.push(Uint8Array.from(f));
    job.onProgress?.(i + 1);
    // let the phone breathe between frames: a progress bar that moves, a tap that lands
    await new Promise((r) => setTimeout(r, 0));
  }
  chunks.push(Uint8Array.from([0x3B]));
  return new Blob(chunks as BlobPart[], { type: "image/gif" });
}
