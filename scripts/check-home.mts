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
ok(/Today's round: \{d\.played\}\/10/.test(home) && /so far/.test(home), "played today, the daily card is your result and your place (#10)");
ok(/\$\{d\.progress\} of 10 answered\. They already count/.test(home), "a half-played daily still says the answers count (D7)");
ok(/`Play \$\{two\.map\(\(p\) => p\.username\)\.join\(" or "\)\}`/.test(home) && />\{who\}</.test(home), "Play someone names the people you play with (#9)");
ok(/<HomeTitle /.test(home) && /Sign in<\/TextPill>/.test(home), "Home's own top: the wordmark, then the streak pill, or Sign in signed out (#8–#11)");
ok(/!waiting && user && !fresh && !p\.playedToday && <PlaySomeone/.test(home) && /!waiting && \(fresh \|\| p\.playedToday\) && <GamesRow/.test(home),
   "as drawn (Daramola 26 Sep): the people before you've played, the games after (or when new), nothing under an invite");
ok(/readGrid\(today\(\)\)/.test(home) && /<DaySeeds /.test(home), "the daily card shows today's ten seeds (#9, #10)");
const shell = readFileSync(new URL("../src/app/layout/Shell.tsx", import.meta.url), "utf8");
ok(/hidden sm:block sticky top-0/.test(shell) && !/RankBadge|Sign up/.test(shell), "no app bar on a phone; each screen has its own title row (Daramola 26 Sep)");

console.log(`${n} Home assertions hold`);
