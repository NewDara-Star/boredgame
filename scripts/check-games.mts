/**
 * Games, redrawn (#12–#14, F23, H6): families, one line a game, no bank
 * counts, a nearest thing when a search finds nothing, and a sheet that asks
 * bot or friend before anything starts. Checked in the source; the screens are
 * in the screenshots.
 */
import { readFileSync } from "node:fs";

let n = 0;
const ok = (c: boolean, m: string) => { n++; if (!c) { console.error("FAIL " + m); process.exit(1); } };
const read = (p: string) => readFileSync(new URL("../src/" + p, import.meta.url), "utf8");
const page = read("features/play/CataloguePage.tsx");
const counts = read("features/play/counts.ts");
const reg = read("features/play/registry.tsx");
const rooms = read("features/rooms/RoomsPage.tsx");

ok(/\["quiz", "Quiz"\].*\["board", "Board"\].*\["puzzle", "Puzzle"\].*\["skill", "Skill"\].*\["party", "Party"\]/.test(page), "games are grouped by family, in order (#12)");
ok(!/in the bank|useCounts/.test(page) && !/count: "exact"|head: true/.test(counts), "no bank counts on the tiles, and none fetched (F23)");
ok(/\.limit\(1\)/.test(counts) && /asked \?\?=/.test(counts), "the live check is one row per bank, once per visit (F23)");
ok(/!!p\.error \|\|/.test(counts) && /!!t\.error \|\|/.test(counts), "a failed check never hides a game");
ok(/Nothing live yet/.test(page), "a bank with nothing live says so instead of opening an empty game");
ok(/g\.like\.some/.test(page) && !/g\.like/.test(page.slice(page.indexOf("function matches"), page.indexOf("function nearest"))), "a search lists only games it names; games it is only like are the nearest thing (#13)");
ok(/No \{q\.trim\(\)\} yet/.test(page) && /The nearest thing is \{near\.name\}/.test(page), "a search that finds nothing names the nearest game (#13)");
const slugs = [...reg.matchAll(/slug: "([a-z0-9]+)"/g)].map((m) => m[1]);
const solos = [...reg.matchAll(/solo: "(bot|alone)",/g)].length;
const hows = [...reg.matchAll(/howTo: "[^"]{20,}"/g)].length;
const akas = [...reg.matchAll(/alsoKnown: \[[^\]]+\], like: \[[^\]]+\]/g)].length;
ok(slugs.length >= 10 && solos === slugs.length && hows === slugs.length && akas === slugs.length, `every game (${slugs.length}) has bot-or-alone, a how-to and other names`);
ok(/"Play the bot" : "Play"/.test(page) && /Play a friend/.test(page) && /How to play/.test(page), "the sheet: play the bot (or just play), play a friend, how to play (#14, H6)");
ok(/state: \{ preset \}/.test(page) && /room\.host_id !== user\.id/.test(rooms) && /presetDone\.current = true/.test(rooms),
   "Play a friend opens a room already set to that game, once, by the host only");

ok(/grid grid-cols-1 gap-2\.5/.test(page) && /w-full min-w-0/.test(page) && !/truncate/.test(page), "tiles fit a phone: a long tagline wraps instead of widening the page");

console.log(`${n} Games assertions hold`);
