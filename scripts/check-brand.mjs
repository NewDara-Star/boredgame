/**
 * The brand fence. Makes "every screen is on the new identity" a number, not a feeling.
 *
 * It does two things:
 *   1. BANS: finds every trace of the old look (hot-pink tokens, cream paper, Fredoka,
 *      outlined .piece cards, tracked caps, stray hex colours...). The migration is done
 *      when every ban reads 0.
 *   2. REQUIRES: lists the things the new identity must have (tokens in one place, every
 *      share point on the new share API, every game with a family...). Done when every
 *      requirement is met.
 *
 * It ratchets. `--write-baseline` records today's counts in scripts/brand-baseline.json;
 * a normal run fails if any ban count went UP or a met requirement is lost, so the build
 * stays green while the migration lands piece by piece, and nothing can slide backwards.
 * `--strict` fails on anything above zero: that is the finish line.
 *
 *   node scripts/check-brand.mjs                  # ratchet against the baseline
 *   node scripts/check-brand.mjs --list           # every hit, file:line
 *   node scripts/check-brand.mjs --write-baseline # after a migration commit, lock the new floor
 *   node scripts/check-brand.mjs --strict         # the finish line
 *
 * A line can opt out with a trailing `brand-ok: <reason>` comment. Use it for real
 * exceptions only; `--list` prints every opt-out so they can be reviewed.
 *
 * Plain .mjs on purpose: it runs in Vercel's build on any Node, no flags.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const args = new Set(process.argv.slice(2));
const BASELINE = path.join(ROOT, "scripts/brand-baseline.json");

// ---------------------------------------------------------------- files
const SCAN_DIRS = ["src"];
const SCAN_FILES = ["index.html", "vite.config.ts", "public/manifest.webmanifest", "public/manifest.json"];
const EXT = new Set([".ts", ".tsx", ".css", ".html", ".json", ".webmanifest"]);
/** The one place colours are allowed to be written as hex. */
const TOKEN_HOME = ["src/shared/brand/", "src/shared/data/rank-badges.json"];

function walk(dir, out = []) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return out;
  for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
    const rel = path.join(dir, e.name);
    if (e.isDirectory()) walk(rel, out);
    else if (EXT.has(path.extname(e.name)) && !e.name.endsWith(".d.ts")) out.push(rel);
  }
  return out;
}
const files = [...SCAN_DIRS.flatMap((d) => walk(d)), ...SCAN_FILES.filter((f) => fs.existsSync(path.join(ROOT, f)))];

// ---------------------------------------------------------------- bans
const OLD = "hot|acid|pop|picto|trivia|good|bad|paper|sand|surface";
const UTIL = "bg|text|border|from|to|via|fill|stroke|ring|outline|decoration|divide|placeholder|caret|accent|shadow";
const COLOURED_BG = `bg-(?:${OLD}|petal|sky|leaf|ember|gum)(?!-)(?:/\\d+)?`;
const BANS = [
  { id: "old-token-class", why: "old palette utility (hot, pop, picto, trivia, good, bad, paper, sand, surface, acid)",
    re: new RegExp(`\\b(?:${UTIL})-(?:${OLD})(?:/\\d+)?\\b`, "g"), in: [".tsx", ".ts"] },
  { id: "old-token-var", why: "old palette CSS variable",
    re: new RegExp(`--color-(?:${OLD})\\b`, "g") },
  { id: "hex-outside-tokens", why: "a colour written as hex outside src/shared/brand; use a token",
    re: /#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b(?![0-9a-fA-F-])|%23[0-9a-fA-F]{6}/g, skipHome: true, skipTheme: true },
  { id: "old-font", why: "Fredoka / Nunito are gone: Bagel Fat One, Atkinson Hyperlegible Next and Mono",
    re: /Fredoka|Nunito/g },
  { id: "toy-primitive", why: ".piece / .press / .sticker: outlined UI cards and plastic presses are the old look",
    re: /(?<=className=[^>]*?)\b(?:piece|press|sticker|sticker-r)\b|^\s*\.(?:piece|press|sticker)\b/gm },
  { id: "tracked-caps", why: "sentence case only: no uppercase or wide tracking",
    re: /\buppercase\b|\btracking-(?:wide|wider|widest)\b|textTransform:\s*["']uppercase/g, in: [".tsx", ".ts", ".css"] },
  { id: "text-glyph", why: "✕ ◯ ✓ ✗ typed as text; use the piece and tick icons",
    re: /[✕◯✓✗✔✘]/g, in: [".tsx", ".ts"] },
  { id: "emoji-in-ui", why: "emoji standing in for drawn icons (the streak flame, stars...)",
    re: /[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}]/gu, in: [".tsx", ".ts"] },
  { id: "old-card-frame", why: "old share-card frame: artStage, hot-pink ground, sticker headline",
    re: /\bartStage\b|\b(?:HOT|POP|PICTO|TRIVIA|SAND)\b(?=\s*[,}])/g, in: [".ts", ".tsx"] },
  { id: "ui-outline", why: "an ink outline on UI (cards, chips, bars, inputs); the world has no outlines, only subjects do",
    re: /\bborder(?:-[trblxy])?-ink\b|\bborder(?:-[trblxy])?-\[\d+px\][^"'`]*?\bborder-ink\b|\bring-ink\b|\boutline-ink\b/g, in: [".tsx", ".ts"] },
  { id: "white-on-colour", why: "letters on colour are ink (grape takes white)",
    re: new RegExp(`["'\`][^"'\`]*?\\b(?:${COLOURED_BG})\\b[^"'\`]*?\\btext-(?:white|surface|paper|board|ground)\\b[^"'\`]*["'\`]|["'\`][^"'\`]*?\\btext-(?:white|surface|paper|board|ground)\\b[^"'\`]*?\\b(?:${COLOURED_BG})\\b[^"'\`]*["'\`]`, "g"), in: [".tsx", ".ts"] },
  { id: "old-theme-meta", why: "theme-color / manifest colours still the old pink or cream",
    re: /#FF2E88|#FBF4E6|%23FF2E88/gi, in: [".html", ".webmanifest", ".json", ".ts"] },
];

// ---------------------------------------------------------------- requirements
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), "utf8"); } catch { return null; } };
const REQUIRES = [
  { id: "tokens-home", why: "one token file for colours, ramps, sky clock and type",
    ok: () => !!read("src/shared/brand/tokens.ts") },
  { id: "theme-from-tokens", why: "index.css @theme defines the new names (petal, sky, leaf, ember, grape, gum, ink, pencil, ground)",
    ok: () => /--color-petal/.test(read("src/index.css") ?? "") && /--color-ground/.test(read("src/index.css") ?? "") },
  { id: "fonts", why: "Bagel Fat One + Atkinson Hyperlegible Next + Mono are loaded",
    ok: () => /Bagel\+Fat\+One|bagel-fat-one/i.test((read("index.html") ?? "") + (read("src/index.css") ?? "")) },
  { id: "sky-clock", why: "the sky follows the phone's clock (a Sky component used by the app shell)",
    ok: () => /\bSky\b/.test(read("src/app/layout/Shell.tsx") ?? "") },
  { id: "mascot", why: "the sunflower component with its states",
    ok: () => !!read("src/shared/brand/Sunflower.tsx") },
  { id: "badges-v3", why: "rank-badges.json is the sunflower ladder",
    ok: () => /"viewBox":"-4 -4/.test(read("src/shared/data/rank-badges.json") ?? "") },
  { id: "game-families", why: "every game in the registry declares a family",
    ok: () => { const r = read("src/features/play/registry.tsx") ?? ""; const ids = (r.match(/\bslug:\s*["']/g) ?? []).length; const fam = (r.match(/\bfamily:\s*["']/g) ?? []).length; return ids > 0 && fam >= ids; } },
  { id: "game-tiles", why: "every game has a cut-gem tile", ok: () => !!read("src/shared/brand/tiles.tsx") },
  { id: "card-v4", why: "share cards paint the six-part layout (world, hook, moment, detail, dare, name)",
    ok: () => /\bpaintDare\b/.test(read("src/shared/card/frame.ts") ?? "") },
  { id: "story-format", why: "every card also comes as a 1080x1920 story", ok: () => /1920/.test(read("src/shared/card/frame.ts") ?? "") },
  ...[
    ["share-match", "src/features/rooms/matchUi.tsx"], ["share-solo", "src/features/play/BoardSoloPage.tsx"],
    ["share-round", "src/features/play/RoundChrome.tsx"], ["share-sort", "src/features/sort/SortSoloPage.tsx"],
    ["share-daily", "src/features/daily/DailyPage.tsx"], ["share-rankup", "src/features/play/Unlock.tsx"],
    ["share-ranks", "src/features/leaderboard/SunRoad.tsx"], ["share-invite", "src/features/rooms/InviteCard.tsx"],
  ].map(([id, f]) => ({ id, why: `${f} shares through the new share API (shareResult, or ShareButtons / ResultScreen which call it)`,
    ok: () => /\bshareResult\b|<ShareButtons\b|<ResultScreen\b/.test(read(f) ?? "") })),
  { id: "share-buttons", why: "ShareButtons calls shareResult and ResultScreen uses ShareButtons, so the share points above really share",
    ok: () => /\bshareResult\(/.test(read("src/shared/card/ShareButtons.tsx") ?? "")
      && /<ShareButtons\b/.test(read("src/features/play/ResultScreen.tsx") ?? "")
      && !/\bsaveCard\(/.test(read("src/features/play/ResultScreen.tsx") ?? "") },
  { id: "link-previews", why: "a Vercel function serves og:image for /r/:code, /d/:date, /f/:user", ok: () => !!(read("api/og.ts") || read("api/og.tsx")) },
];

// ---------------------------------------------------------------- run
const hits = Object.fromEntries(BANS.map((b) => [b.id, []]));
const optOuts = [];
for (const f of files) {
  const text = fs.readFileSync(path.join(ROOT, f), "utf8");
  const ext = path.extname(f);
  const lines = text.split("\n");
  let inTheme = false;
  lines.forEach((line, i) => {
    if (f.endsWith(".css")) { if (/@theme\b/.test(line)) inTheme = true; else if (inTheme && /^\}/.test(line)) inTheme = false; }
    const ok = /brand-ok:/.test(line);
    for (const b of BANS) {
      if (b.in && !b.in.includes(ext)) continue;
      if (b.skipHome && TOKEN_HOME.some((h) => f.startsWith(h))) continue;
      if (b.skipTheme && inTheme) continue;
      const m = line.match(b.re);
      if (!m) continue;
      if (ok) { optOuts.push(`${f}:${i + 1}  ${line.trim().slice(0, 110)}`); continue; }
      for (const x of m) hits[b.id].push(`${f}:${i + 1}  ${x}`);
    }
  });
}
const counts = Object.fromEntries(BANS.map((b) => [b.id, hits[b.id].length]));
const met = Object.fromEntries(REQUIRES.map((r) => [r.id, !!r.ok()]));

const base = fs.existsSync(BASELINE) ? JSON.parse(fs.readFileSync(BASELINE, "utf8")) : null;
if (args.has("--write-baseline")) {
  fs.writeFileSync(BASELINE, JSON.stringify({ bans: counts, met }, null, 2) + "\n");
}

const pad = (s, n) => String(s).padEnd(n);
let worse = [];
console.log("\nBANS (old look still in the code)                     now   floor");
for (const b of BANS) {
  const floor = base?.bans?.[b.id];
  if (floor !== undefined && counts[b.id] > floor) worse.push(`${b.id} went up: ${floor} → ${counts[b.id]}`);
  console.log(`  ${pad(b.id, 20)} ${pad(b.why.slice(0, 30), 32)} ${pad(counts[b.id], 5)} ${floor ?? "-"}`);
}
const totalBans = Object.values(counts).reduce((a, c) => a + c, 0);
console.log(`  ${pad("total", 53)} ${totalBans}`);
console.log("\nREQUIRES (new identity in place)");
for (const r of REQUIRES) {
  if (base?.met?.[r.id] && !met[r.id]) worse.push(`${r.id} was met and is now missing`);
  console.log(`  ${met[r.id] ? "✔" : "·"} ${pad(r.id, 18)} ${r.why}`);
}
const todo = REQUIRES.filter((r) => !met[r.id]).length;
console.log(`  ${REQUIRES.length - todo}/${REQUIRES.length} met`);

if (args.has("--list")) {
  for (const b of BANS) if (hits[b.id].length) { console.log(`\n## ${b.id} (${hits[b.id].length}): ${b.why}`); hits[b.id].forEach((h) => console.log("  " + h)); }
  if (optOuts.length) { console.log(`\n## opted out with brand-ok (${optOuts.length})`); optOuts.forEach((h) => console.log("  " + h)); }
}

if (args.has("--strict")) {
  if (totalBans || todo) { console.log(`\nNot done: ${totalBans} old-look hits, ${todo} requirements unmet.`); process.exit(1); }
  console.log("\nDone: no old look left, every requirement met."); process.exit(0);
}
if (worse.length) { console.log("\nRegressed:\n  " + worse.join("\n  ")); process.exit(1); }
console.log(`\nRatchet holds. ${totalBans} old-look hits and ${todo} requirements to go.`);
