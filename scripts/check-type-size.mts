/**
 * A floor on type size.
 *
 * The app had 61 uses of 10 and 11px text, which is where an older player stops
 * being able to read the labels — and they are labels, not decoration: "3 to
 * go", the category counts, whose turn it is. Nothing in the interface goes
 * below 12px. This exists because the next arbitrary value someone reaches for
 * will be 10px again.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const FLOOR = 12;
const files: string[] = [];
(function walk(dir: string) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(tsx?|css)$/.test(e)) files.push(p);
  }
})("src");

const offences: string[] = [];
for (const f of files) {
  readFileSync(f, "utf8").split("\n").forEach((line, i) => {
    for (const m of line.matchAll(/text-\[(\d+(?:\.\d+)?)px\]/g)) {
      if (Number(m[1]) < FLOOR) offences.push(`${f}:${i + 1}  ${m[0]}`);
    }
    for (const m of line.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g)) {
      if (Number(m[1]) < FLOOR) offences.push(`${f}:${i + 1}  font-size: ${m[1]}px`);
    }
  });
}

if (offences.length) {
  console.error(`Text below ${FLOOR}px, which is the floor:\n  ` + offences.join("\n  "));
  process.exit(1);
}
console.log(`no text below ${FLOOR}px across ${files.length} files`);
