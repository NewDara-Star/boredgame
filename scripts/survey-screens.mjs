/**
 * Measure every screen against the phone it is played on.
 *
 * check-layout.mts proves the SHAPE — that a play screen is a fixed-height
 * column whose board is given a measured width. This proves the pixels, which
 * needs a browser. It is not part of the build: Playwright is not a dependency
 * of this app, and a check that needs a 300MB browser to run is a check nobody
 * runs. Point it at a built bundle when a screen changes shape.
 *
 *   npx vite build --outDir dist
 *   node scripts/survey-screens.mjs dist        # needs playwright on the PATH
 *
 * Two heights, both 390 wide: 844 is the phone installed to the home screen,
 * 664 is the same phone in Safari with its bars. The app's own chrome is 62px
 * of header and 62px of bottom bar, so the usable heights are 714 and 534.
 * Anything a play screen puts below that is something the player has to
 * scroll to find, and the survey names it.
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const ROOT = path.resolve(process.argv[2] ?? "dist");
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".woff2": "font/woff2" };
const server = http.createServer((q, r) => {
  const u = new URL(q.url, "http://x");
  let f = path.join(ROOT, u.pathname);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(ROOT, "index.html");
  r.writeHead(200, { "content-type": MIME[path.extname(f)] ?? "application/octet-stream" });
  fs.createReadStream(f).pipe(r);
});
await new Promise((r) => server.listen(4321, r));

const browser = await chromium.launch();
const rows = [];

async function measure(p, name, vh) {
  const m = await p.evaluate(() => {
    const header = document.querySelector("header");
    const nav = [...document.querySelectorAll("nav")].find((n) => getComputedStyle(n).position === "fixed");
    const foldY = nav ? nav.getBoundingClientRect().top : innerHeight;
    const main = document.querySelector("main") || document.body;
    // what is entirely below the fold on first paint — the things you would
    // have to scroll to reach
    const below = [];
    const seen = [];
    for (const e of main.querySelectorAll("*")) {
      const r = e.getBoundingClientRect();
      if (!(r.height > 24 && r.width > 200 && r.top >= foldY - 4 && e.children.length < 12)) continue;
      if (seen.some((s) => s.contains(e))) continue;
      seen.push(e);
      below.push((e.getAttribute("aria-label") || e.textContent || "").trim().replace(/\s+/g, " ").slice(0, 30));
      if (below.length >= 3) break;
    }
    return {
      header: Math.round(header?.getBoundingClientRect().height ?? 0),
      usable: Math.round(foldY - (header?.getBoundingClientRect().height ?? 0)),
      overflow: Math.max(0, document.documentElement.scrollHeight - innerHeight),
      below,
    };
  });
  rows.push({ name, vh, ...m });
}

const PAGES = [
  ["Home", "/"], ["Games", "/play"], ["Rooms", "/rooms"], ["Ranks", "/ranks"],
  ["Profile", "/profile"], ["Daily", "/daily"], ["Trivia", "/trivia"], ["Picto", "/picto"],
  ["Square Off", "/squareoff"], ["Tic Tac Toe", "/tictactoe"], ["Connect 4", "/connect4"],
  ["Connect 4 Trivia", "/connect4trivia"], ["Connect 4 Catapult", "/connect4catapult"],
  ["Catapult Squares", "/catapultsquares"], ["Memory", "/memory"], ["Ball Sort", "/ballsort"],
];

for (const vh of [844, 664]) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: vh } });
  await ctx.route("**://*.supabase.co/**", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  const p = await ctx.newPage();
  for (const [name, at] of PAGES) {
    await p.goto("http://localhost:4321" + at, { waitUntil: "networkidle" });
    await p.waitForTimeout(700);
    await measure(p, name, vh);
    // and again with whatever the game asks for on screen, which is the state
    // that used to overflow
    const pick = p.locator('[aria-label$="open"]:not([disabled])').first();
    if (await pick.count()) {
      await pick.click();
      await p.waitForTimeout(700);
      await measure(p, name + " · asking", vh);
    }
  }
  await ctx.close();
}

let bad = 0;
for (const r of rows) {
  const over = r.overflow > 0;
  if (over && /Square Off|Tic Tac|Connect 4|Memory|Catapult|Trivia|Picto/.test(r.name)) bad++;
  console.log(
    `${r.vh} | ${r.name.padEnd(28)} | usable ${r.usable} | +${String(r.overflow).padStart(4)}px below` +
    (r.below.length ? ` | below: ${r.below.join(" · ")}` : ""),
  );
}
console.log(bad === 0 ? "\nevery play screen fits the phone it is played on"
  : `\n${bad} play screens overflow — see the list above`);
await browser.close();
server.close();
process.exit(bad === 0 ? 0 : 1);
