import { scopePool, emptyReason, levelCounts, LEVELS } from "../src/features/play/scope.ts";

let n = 0;
const ok = (c: boolean, m: string) => {
  n++;
  if (!c) { console.error("FAIL " + m); process.exit(1); }
};

const P = (category: string, difficulty: string, id = "") => ({ category, difficulty, id });
const pool = [
  P("Sport", "easy", "a"), P("Sport", "hard", "b"), P("Sport", "medium", "c"),
  P("Maths", "easy", "d"), P("Maths", "hard", "e"),
  P("Design", "medium", "f"),
];
const ids = (xs: { id: string }[]) => xs.map((x) => x.id).sort().join("");

// --- no restriction means no restriction, however it is spelled -------------
ok(scopePool(pool, {}) === pool, "empty scope returns the pool itself, unfiltered");
ok(scopePool(pool, { categories: null, difficulty: null }) === pool, "null/null is unrestricted");
ok(scopePool(pool, { categories: [], difficulty: [] }) === pool, "empty arrays are unrestricted");
ok(scopePool(pool, { categories: [] }).length === 6, "an empty category list never means zero");
ok(scopePool(pool, { difficulty: [] }).length === 6, "an empty difficulty list never means zero");

// --- each axis alone --------------------------------------------------------
ok(ids(scopePool(pool, { categories: ["Sport"] })) === "abc", "category alone");
ok(ids(scopePool(pool, { difficulty: ["easy"] })) === "ad", "difficulty alone");
ok(ids(scopePool(pool, { difficulty: ["easy", "medium"] })) === "acdf", "two levels");
ok(ids(scopePool(pool, { categories: ["Sport", "Maths"] })) === "abcde", "two categories");

// --- both at once, which is where the old per-call-site filters stopped ------
ok(ids(scopePool(pool, { categories: ["Sport"], difficulty: ["easy"] })) === "a", "both axes");
ok(scopePool(pool, { categories: ["Design"], difficulty: ["hard"] }).length === 0,
   "a category and a level that are each fine alone can still intersect to nothing");
ok(scopePool(pool, { categories: ["Nope"] }).length === 0, "an unknown category yields nothing");
ok(scopePool(pool, { difficulty: ["legendary"] }).length === 0, "an unknown level yields nothing");

// --- the pool is never mutated ---------------------------------------------
const before = pool.length;
scopePool(pool, { categories: ["Sport"] });
ok(pool.length === before, "filtering does not mutate the pool");

// --- the empty message names the real cause --------------------------------
ok(emptyReason({}, true).includes("No questions"), "empty bank says so");
ok(emptyReason({ categories: ["Sport"] }, false).includes("Sport"), "names the category");
ok(emptyReason({ difficulty: ["hard"] }, false).includes("hard"), "names the level");
const both = emptyReason({ categories: ["Design"], difficulty: ["hard"] }, false);
ok(both.includes("Design") && both.includes("hard"), "names both when both are set");
ok(!emptyReason({ categories: ["Sport"] }, false).includes("undefined"), "no undefined leaks in");

// --- counts drive the lobby's numbers, so they must match the filter --------
const c = levelCounts(pool);
ok(c.easy === 2 && c.medium === 2 && c.hard === 2, "counts over the whole pool");
const cs = levelCounts(pool, ["Sport"]);
ok(cs.easy === 1 && cs.medium === 1 && cs.hard === 1, "counts respect the category filter");
for (const l of LEVELS) {
  ok(levelCounts(pool)[l] === scopePool(pool, { difficulty: [l] }).length,
     `count for ${l} equals what the filter actually returns`);
}
for (const l of LEVELS) {
  ok(levelCounts(pool, ["Maths"])[l] === scopePool(pool, { categories: ["Maths"], difficulty: [l] }).length,
     `scoped count for ${l} equals the scoped filter`);
}
// a level with nothing in it must count zero rather than be absent
ok(levelCounts(pool, ["Design"]).easy === 0, "a level with no rows counts zero, not undefined");

console.log(`${n} assertions hold`);
