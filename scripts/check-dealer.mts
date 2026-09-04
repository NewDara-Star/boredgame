/**
 * The room served one identical question for the rest of a session once its
 * category was exhausted, and silently ignored the filter when the category had
 * nothing in it. Both were one line of fallback. This checks the replacement.
 * Run: node --experimental-strip-types scripts/check-dealer.mts
 */
import { deal } from "../src/features/play/dealer.ts";

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

console.log(failed === 0 ? "\ndealing is sound" : `\n${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);
