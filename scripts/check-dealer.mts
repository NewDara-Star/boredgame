/**
 * The room served one identical question for the rest of a session once its
 * category was exhausted, and silently ignored the filter when the category had
 * nothing in it. Both were one line of fallback. This checks the replacement.
 * Run: node --experimental-strip-types scripts/check-dealer.mts
 */
import { deal, pickRound } from "../src/features/play/dealer.ts";
import { readFileSync } from "node:fs";

let failed = 0;
const ok = (name: string, cond: boolean, detail = "") => {
  if (!cond) { failed++; console.log(`  FAIL  ${name} ${detail}`); }
  else console.log(`  ok    ${name} ${detail}`);
};

const id = (s: string) => s;
const POOL = ["a", "b", "c", "d", "e"];

console.log("a full cycle");
{
  const seen = new Set<string>();
  const got: string[] = [];
  for (let i = 0; i < POOL.length; i++) {
    const d = deal(POOL, id, seen);
    got.push(d.item!);
    ok(`deal ${i + 1} did not recycle early`, !d.recycled);
  }
  ok("serves every item before repeating any",
    new Set(got).size === POOL.length, `(${got.join("")})`);
}

console.log("\nexhaustion starts a new cycle instead of sticking");
{
  const seen = new Set<string>();
  let last: string | null = null;
  const served: string[] = [];
  let recycles = 0;
  for (let i = 0; i < 23; i++) {
    const d = deal(POOL, id, seen, { avoid: last });
    if (d.recycled) recycles++;
    last = d.item;
    served.push(d.item!);
  }
  ok("it recycled rather than repeating one item", recycles >= 4, `(${recycles} cycles)`);
  ok("never the same item twice in a row", served.every((s, i) => i === 0 || s !== served[i - 1]),
    `(${served.join("")})`);
  // The old code served scoped[0] forever past exhaustion: 23 deals of 5 items
  // would have been 19 identical ones.
  const counts = POOL.map((p) => served.filter((s) => s === p).length);
  ok("no item dominates", Math.max(...counts) <= 7, `(max ${Math.max(...counts)} of 23)`);
}

console.log("\nedges");
{
  ok("an empty pool reports nothing rather than inventing one",
    deal([], id, new Set()).item === null);
  const single = deal(["only"], id, new Set(["only"]), { avoid: "only" });
  ok("a single-item pool still serves it", single.item === "only" && single.recycled);
  const before = [...POOL];
  deal(POOL, id, new Set());
  ok("does not mutate the pool", JSON.stringify(POOL) === JSON.stringify(before));
  const seen = new Set<string>(["a", "b", "c", "d", "e"]);
  deal(POOL, id, seen);
  ok("a recycle clears the seen set", seen.size === 1);
}

// --- a solo round: unseen first, then the longest-ago -------------------------
{
  const same = <U,>(xs: U[]) => xs.slice();              // no randomness in a check
  const ids = (xs: string[]) => xs.slice().sort().join(",");
  const bank = Array.from({ length: 30 }, (_, k) => "q" + k);
  const seenAll = bank.filter((id) => !["q3", "q9", "q14", "q20", "q21", "q27"].includes(id));  // 6 unseen
  const r = pickRound(bank, (x) => x, seenAll, 10, same);
  ok("a round has its size", r.length === 10);
  ok("all 6 unseen questions are in it", ["q3", "q9", "q14", "q20", "q21", "q27"].every((q) => r.includes(q)));
  ok("topped up with the 4 seen longest ago", ids(r.filter((q) => seenAll.includes(q))) === ids(seenAll.slice(0, 4)));
  ok("no question twice", new Set(r).size === r.length);
  const allNew = pickRound(bank, (x) => x, [], 10, same);
  ok("with plenty unseen, only unseen", allNew.length === 10);
  const small = pickRound(bank.slice(0, 4), (x) => x, ["q0"], 10, same);
  ok("a pool smaller than a round gives the whole pool", ids(small) === ids(bank.slice(0, 4)));
  ok("an empty pool gives an empty round", pickRound([], (x: string) => x, [], 10, same).length === 0);
}

console.log("stuck on a picture (talk item 5)");
{
  // The old code had no way on but a wrong answer; missing helpers fail here.
  let skip: { sendToBack?: <T>(l: T[], i: number) => T[]; canSkip?: (id: string, i: number, n: number, s: ReadonlySet<string>) => boolean } = {};
  try { skip = await import("../src/features/play/skip.ts"); } catch { /* not there */ }
  const { sendToBack, canSkip } = skip;
  ok("a picture can be sent to the back of the round", typeof sendToBack === "function" && typeof canSkip === "function");
  if (sendToBack && canSkip) {
    ok("it goes to the end; the next one takes its place", sendToBack(["a", "b", "c", "d"], 1).join("") === "acdb");
    ok("the last one has nowhere to go", sendToBack(["a", "b"], 1).join("") === "ab" && !canSkip("b", 1, 2, new Set()));
    ok("skipping is once per picture", canSkip("b", 1, 4, new Set()) && !canSkip("b", 3, 4, new Set(["b"])));
    ok("nothing is lost or doubled", sendToBack(["a", "b", "c"], 0).slice().sort().join("") === "abc");
  }
  const rd = (f: string) => { try { return readFileSync(new URL(`../src/${f}`, import.meta.url), "utf8"); } catch { return ""; } };
  const round = rd("features/play/useRound.ts"), picto = rd("features/picto/PictoGame.tsx");
  ok("a returning picture keeps its time and its clues", /startedAt\.current = Date\.now\(\) - \(back\?\.ms \?\? 0\)/.test(round) && /setHintsUsed\(back\?\.hints \?\? 0\)/.test(round));
  ok("Show me files a miss (nothing typed)", /giveUp: \(\) => submit\(""\)/.test(round));
  ok("Picto offers Skip, then Show me", /r\.canSkip \? r\.skip : r\.giveUp/.test(picto) && /counts as a miss/.test(picto));
}

console.log("how hard the solo board questions are (talk item 9)");
{
  let lv: { readLevels?: () => string[]; toggle?: (l: string[], x: string) => string[]; atLevels?: <T extends { difficulty: string }>(p: T[], l: string[]) => T[] } = {};
  try { lv = await import("../src/features/play/levels.ts"); } catch { /* not there */ }
  const { readLevels, toggle, atLevels } = lv;
  ok("solo boards have a level choice", typeof readLevels === "function" && typeof toggle === "function" && typeof atLevels === "function");
  if (readLevels && toggle && atLevels) {
    ok("a new phone starts on easy + medium: nothing hard until asked for", readLevels().join(",") === "easy,medium");
    ok("hard can be added, in order", toggle(["easy", "medium"], "hard").join(",") === "easy,medium,hard");
    ok("a level can be taken off", toggle(["easy", "medium"], "medium").join(",") === "easy");
    ok("but never the last one", toggle(["easy"], "easy").join(",") === "easy");
    const bank = [{ difficulty: "easy" }, { difficulty: "hard" }, { difficulty: "medium" }];
    ok("the pool is the chosen levels", atLevels(bank, ["easy"]).length === 1 && atLevels(bank, ["easy", "medium"]).every((q) => q.difficulty !== "hard"));
    ok("a level with nothing in it falls back to the whole bank", atLevels([{ difficulty: "hard" }], ["easy"]).length === 1);
  }
  const rd = (f: string) => { try { return readFileSync(new URL(`../src/${f}`, import.meta.url), "utf8"); } catch { return ""; } };
  ok("the solo board deals from the chosen levels", /atLevels\(everyRef\.current, readLevels\(\)\)/.test(rd("features/play/useSoloBoard.ts")));
  ok("the choice shows before a game's first question", /g\.phase === "picking" && s\.results\.length === 0/.test(rd("features/play/BoardSoloPage.tsx")));
}

console.log(failed === 0 ? "\ndealing is sound" : `\n${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);
