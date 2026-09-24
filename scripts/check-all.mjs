/**
 * Runs every check in scripts/, in parallel, and fails if any fails (F50, T1).
 *
 * The build used to run check-brand and the type check and nothing else: eight
 * checks had an npm command, eleven had none, and nothing ran them. A rule could
 * break and still deploy. `npm run build` runs this first, so it can't.
 *
 * A new check-*.mts or check-*.mjs file is picked up by name; nothing to register.
 */
import { spawn } from "node:child_process";
import { readdirSync } from "node:fs";
import { availableParallelism } from "node:os";

const dir = new URL(".", import.meta.url).pathname;
const checks = readdirSync(dir).filter((f) => /^check-[a-z0-9-]+\.m[tj]s$/.test(f) && f !== "check-all.mjs").sort();

function run(file) {
  const started = performance.now();
  const args = file.endsWith(".mts") ? ["--experimental-strip-types", "--no-warnings", dir + file] : [dir + file];
  return new Promise((done) => {
    const p = spawn(process.execPath, args, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (out += d));
    p.on("close", (code) => done({ file, code, out, ms: performance.now() - started }));
  });
}

const t0 = performance.now();
const queue = [...checks];
const results = [];
await Promise.all(Array.from({ length: Math.max(2, availableParallelism()) }, async () => {
  while (queue.length) results.push(await run(queue.shift()));
}));
results.sort((a, b) => a.file.localeCompare(b.file));

const failed = results.filter((r) => r.code !== 0);
for (const r of results) {
  const last = r.out.trim().split("\n").filter(Boolean).at(-1) ?? "";
  console.log(`${r.code === 0 ? "ok  " : "FAIL"} ${r.file.padEnd(22)} ${(r.ms / 1000).toFixed(1).padStart(4)}s  ${r.code === 0 ? last.slice(0, 70) : ""}`);
}
for (const r of failed) console.error(`\n---- ${r.file} ----\n${r.out.trim().split("\n").slice(-25).join("\n")}`);
console.log(`\n${results.length - failed.length} of ${results.length} checks pass (${((performance.now() - t0) / 1000).toFixed(1)}s)`);
if (checks.length < 20) { console.error(`only found ${checks.length} checks, expected 20 or more`); process.exit(1); }
process.exit(failed.length ? 1 : 0);
