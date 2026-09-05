/**
 * The Ball Sort bank: every puzzle the game will ever deal, solved in advance.
 *
 * Under the physical rules — any top ball onto any tube with room — a phone
 * cannot solve a 5-colour board in time (A* runs 0.2 s at the median and
 * 17 s at the tail on a laptop; plain BFS does not finish). So nothing is
 * solved on a phone. This script draws random boards, runs A* on each here,
 * bands them by the length of the shortest solution, and writes
 * src/features/sort/bank.ts: the board, and the shortest line through it.
 * Both phones pick from that file by seed; the bot plays the stored line;
 * the edge function replays finishes against the same file.
 *
 * Reproducible: the draw is seeded, so re-running yields the same bank.
 *   node --experimental-strip-types scripts/sort-bank.mts run <worker> <perBand>
 *     solves boards into $HOME/sortbank.<worker>.json (resumable; run several)
 *   node --experimental-strip-types scripts/sort-bank.mts emit <perBand>
 *     merges every worker file into src/features/sort/bank.ts
 * Slow by design — minutes — which is the whole reason it is not on a phone.
 */
import { writeFileSync, readFileSync, existsSync } from "node:fs";

const CAP = 4, COLOURS = 5, TUBES = 6;
/** shortest-solution bands. Measured on 205 random boards: par runs 13–24,
    median 20; ≤18 is ~30% of draws, 19–21 ~49%, ≥22 ~21%. */
export const BANDS = { easy: [0, 18], medium: [19, 21], hard: [22, 99] } as const;
type Level = keyof typeof BANDS;
type Tube = number[];

const mode = process.argv[2];
const worker = Number(process.argv[3] ?? 0);
const perBand = Number(process.argv[mode === "emit" ? 3 : 4] ?? 100);
const STATE_CAP = 3_000_000;

function stream(seed: number): () => number {
  let s = (Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b) >>> 0) || 1;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}
const isUniform = (t: Tube) => t.every((c) => c === t[0]);
const keyOf = (tubes: Tube[]) => tubes.map((t) => t.join("")).sort().join("|");
const decode = (k: string): Tube[] => k.split("|").map((s) => [...s].map(Number));

/** Admissible, consistent lower bound: each colour needs a home tube; a tube
    is worth its bottom run of that colour minus the balls of it stacked above
    (they must leave and come back). Best assignment via a bitmask DP. */
function h(tubes: Tube[]): number {
  const T = tubes.length;
  const w: number[][] = [];
  for (let c = 0; c < COLOURS; c++) {
    w.push([]);
    for (let t = 0; t < T; t++) {
      const tube = tubes[t];
      let run = 0; while (run < tube.length && tube[run] === c) run++;
      let above = 0; for (let i = run; i < tube.length; i++) if (tube[i] === c) above++;
      w[c][t] = run - above;
    }
  }
  let dp = new Map<number, number>([[0, 0]]);
  for (let c = 0; c < COLOURS; c++) {
    const nd = new Map<number, number>();
    for (const [mask, v] of dp) for (let t = 0; t < T; t++) {
      if (mask & (1 << t)) continue;
      const m2 = mask | (1 << t), v2 = v + w[c][t];
      if ((nd.get(m2) ?? -Infinity) < v2) nd.set(m2, v2);
    }
    dp = nd;
  }
  let best = -Infinity; for (const v of dp.values()) best = Math.max(best, v);
  return COLOURS * CAP - best;
}

/** A* on canonical positions. A move is remembered as the CONTENTS of the two
    tubes it touched, not their indices — indices are meaningless once tubes
    are sorted into a key — and turned back into indices against the real
    board afterwards. */
function astar(start: Tube[]): { line: [number, number][]; expanded: number } | null {
  const sk = keyOf(start);
  const g = new Map<string, number>([[sk, 0]]);
  const parent = new Map<string, [string, string, string]>();
  const buckets: string[][] = [];
  (buckets[h(start)] ??= []).push(sk);
  let f = 0, expanded = 0, goal: string | null = null;
  outer: for (;;) {
    while (f < buckets.length && (!buckets[f] || buckets[f].length === 0)) f++;
    if (f >= buckets.length) return null;
    const k = buckets[f].pop()!;
    const gk = g.get(k)!;
    const tubes = decode(k);
    const hk = h(tubes);
    if (gk + hk !== f) continue;
    if (hk === 0) { goal = k; break outer; }
    if (++expanded % 4096 === 0 && g.size > STATE_CAP) return null;
    for (let from = 0; from < tubes.length; from++) {
      if (tubes[from].length === 0) continue;
      for (let to = 0; to < tubes.length; to++) {
        if (to === from || tubes[to].length >= CAP) continue;
        const t2 = tubes.map((x) => x.slice());
        t2[to].push(t2[from].pop()!);
        const k2 = keyOf(t2), g2 = gk + 1;
        const old = g.get(k2);
        if (old !== undefined && old <= g2) continue;
        g.set(k2, g2);
        parent.set(k2, [k, tubes[from].join(""), tubes[to].join("")]);
        const f2 = g2 + h(t2);
        (buckets[f2] ??= []).push(k2);
        if (f2 < f) f = f2;
      }
    }
  }
  // walk back to the start in content form, then forward on the real board
  const steps: [string, string][] = [];
  for (let k = goal!; k !== sk;) { const [p, a, b] = parent.get(k)!; steps.push([a, b]); k = p; }
  steps.reverse();
  const board = start.map((t) => t.slice());
  const line: [number, number][] = [];
  for (const [a, b] of steps) {
    const from = board.findIndex((t) => t.join("") === a);
    const to = board.findIndex((t, i) => i !== from && t.join("") === b);
    if (from < 0 || to < 0) throw new Error("path reconstruction lost a tube");
    board[to].push(board[from].pop()!);
    line.push([from, to]);
  }
  return { line, expanded };
}

function draw(next: () => number): Tube[] {
  const balls: number[] = [];
  for (let c = 0; c < COLOURS; c++) for (let i = 0; i < CAP; i++) balls.push(c);
  for (let i = balls.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1)); [balls[i], balls[j]] = [balls[j], balls[i]];
  }
  const tubes: Tube[] = [];
  for (let c = 0; c < COLOURS; c++) tubes.push(balls.slice(c * CAP, c * CAP + CAP));
  for (let e = COLOURS; e < TUBES; e++) tubes.push([]);
  return tubes;
}
const bandOf = (par: number): Level | null => {
  for (const [name, [lo, hi]] of Object.entries(BANDS)) if (par >= lo && par <= hi) return name as Level;
  return null;
};

type Entry = { t: string; line: string; expanded: number };
type Progress = { seed: number; drawn: number; skipped: number; bank: Record<Level, Entry[]> };
const progressPath = (w: number) => `${process.env.HOME}/sortbank.${w}.json`;

if (mode === "run") run();
else if (mode === "emit") emit();
else if (import.meta.url === `file://${process.argv[1]}`) console.error("usage: sort-bank.mts run <worker> <perBand> | emit <perBand>");

function run() {
const prog: Progress = existsSync(progressPath(worker))
  ? JSON.parse(readFileSync(progressPath(worker), "utf8"))
  : { seed: 0xB0A7 + worker * 7919, drawn: 0, skipped: 0, bank: { easy: [], medium: [], hard: [] } };
const next = stream(prog.seed);
for (let i = 0; i < prog.drawn; i++) for (let k = 0; k < 40; k++) next(); // replay the stream
const seen = new Set<string>();
for (const lv of Object.keys(prog.bank) as Level[]) for (const e of prog.bank[lv]) seen.add(keyOf(e.t.split("/").map((s) => [...s].map(Number))));

const full = () => (Object.keys(BANDS) as Level[]).every((lv) => prog.bank[lv].length >= perBand);
while (!full()) {
  const tubes = draw(next);
  for (let k = 0; k < 40 - (COLOURS * CAP - 1); k++) next(); // a fixed 40 draws per board, so replay is exact
  prog.drawn++;
  if (tubes.some((t) => t.length === CAP && isUniform(t))) continue;
  const key = keyOf(tubes);
  if (seen.has(key)) continue;
  const t0 = performance.now();
  const r = astar(tubes);
  const ms = performance.now() - t0;
  if (!r) { prog.skipped++; console.log(`  #${prog.drawn} skipped (over ${STATE_CAP} states, ${ms.toFixed(0)}ms)`); continue; }
  const par = r.line.length, band = bandOf(par);
  const counts = (Object.keys(BANDS) as Level[]).map((lv) => `${lv} ${prog.bank[lv].length}`).join(", ");
  if (!band || prog.bank[band].length >= perBand) { console.log(`  #${prog.drawn} par ${par} (${ms.toFixed(0)}ms) — ${band ?? "out of band"} full; ${counts}`); continue; }
  seen.add(key);
  prog.bank[band].push({ t: tubes.map((t) => t.join("")).join("/"), line: r.line.map(([a, b]) => `${a}${b}`).join(""), expanded: r.expanded });
  console.log(`  #${prog.drawn} par ${par} → ${band} (${ms.toFixed(0)}ms, ${r.expanded} expanded); ${counts}`);
  writeFileSync(progressPath(worker), JSON.stringify(prog));
}
console.log(`worker ${worker} done: ${prog.drawn} drawn, ${prog.skipped} skipped`);
}

/** Merge the workers' files into the shipped bank. Each shelf is sorted by
    how much search its board took, so a check script can re-solve the first
    few cheaply; seeds pick uniformly, so order does not affect play. */
function emit() {
  const shelves: Record<Level, Entry[]> = { easy: [], medium: [], hard: [] };
  const seen = new Set<string>();
  for (let w = 0; existsSync(progressPath(w)); w++) {
    const prog: Progress = JSON.parse(readFileSync(progressPath(w), "utf8"));
    for (const lv of Object.keys(shelves) as Level[]) for (const e of prog.bank[lv]) {
      const k = keyOf(e.t.split("/").map((s) => [...s].map(Number)));
      if (seen.has(k)) continue;
      seen.add(k); shelves[lv].push(e);
    }
  }
  for (const lv of Object.keys(shelves) as Level[]) {
    shelves[lv].sort((a, b) => a.expanded - b.expanded);
    if (shelves[lv].length < perBand) throw new Error(`${lv}: only ${shelves[lv].length} of ${perBand} — run more workers`);
    shelves[lv] = shelves[lv].slice(0, perBand);
  }
  const body = (Object.keys(shelves) as Level[]).map((lv) =>
    `  ${lv}: [
${shelves[lv].map((e) => `    ["${e.t}", "${e.line}"],`).join("\n")}
  ],`).join("\n");
  const out = `/**
 * GENERATED by scripts/sort-bank.mts — do not edit by hand.
 *
 * Every Ball Sort board the game deals, with one shortest line through each,
 * solved in advance because a phone cannot solve them live. An entry is
 * [board, line]: the board in the wire form rules.ts reads ("0123/…", bottom
 * first, "/" between tubes), the line as two digits a move (tube to tube).
 * Par is the length of the line. Shelves: easy ≤ ${BANDS.easy[1]}, medium ${BANDS.medium[0]}–${BANDS.medium[1]}, hard ≥ ${BANDS.hard[0]}.
 */
export type BankEntry = readonly [board: string, line: string];
export const BANK: Record<"easy" | "medium" | "hard", readonly BankEntry[]> = {
${body}
};
`;
  const path = new URL("../src/features/sort/bank.ts", import.meta.url);
  writeFileSync(path, out);
  console.log(`wrote ${path.pathname}: ${(Object.keys(shelves) as Level[]).map((lv) => `${lv} ${shelves[lv].length}`).join(", ")}`);
}
