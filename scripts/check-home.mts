/**
 * Home, redrawn (#8–#11, H4, F23): one thing leads, and the dashboard of zeros
 * is gone. Checked in the source; the four states are in the screenshots.
 */
import { readFileSync, existsSync } from "node:fs";

let n = 0;
const ok = (c: boolean, m: string) => { n++; if (!c) { console.error("FAIL " + m); process.exit(1); } };
const home = readFileSync(new URL("../src/features/home/HomePage.tsx", import.meta.url), "utf8");

ok(!/WeekStrip|StatCarousel|greeting\(\)|"stranger"/.test(home), "no greeting, week strip or stat tiles (H4)");
ok(!existsSync(new URL("../src/features/home/WeekStrip.tsx", import.meta.url)) && !existsSync(new URL("../src/features/home/StatCarousel.tsx", import.meta.url)),
   "and their files are gone, not left dead");
ok(!/useCounts|in the bank/.test(home), "Home doesn't count the question bank on every visit (F23)");
const order = ["<InviteHero", "I'm so bored.", "in a row", "Safe till tomorrow."].map((t) => home.indexOf(t));
ok(order.every((i) => i > 0) && order.every((i, k) => k === 0 || i > order[k - 1]), "an invite leads, then new / streak on the line / streak safe (#11, #8, #9, #10)");
ok(/Today's round: \$\{d\.played\}\/10/.test(home) && /so far/.test(home), "played today, the daily card is your result and your place (#10)");
ok(/\$\{d\.progress\} of 10 answered\. They already count/.test(home), "a half-played daily still says the answers count (D7)");
ok(/>Play \{who\}</.test(home), "Play someone names the people you play with (#9)");

console.log(`${n} Home assertions hold`);
