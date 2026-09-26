/**
 * Today's round, redrawn (#15–#19), with Daramola's calls of 26 Sep: no clock on
 * screen, the nav steps aside while you play and an X leads out, the points line
 * stays under "Yes!", and the done screen shows everyone. Checked in the source;
 * the screens are in the screenshots.
 */
import { readFileSync } from "node:fs";

let n = 0;
const ok = (c: boolean, m: string) => { n++; if (!c) { console.error("FAIL " + m); process.exit(1); } };
const read = (p: string) => readFileSync(new URL("../src/" + p, import.meta.url), "utf8");
const daily = read("features/daily/DailyPage.tsx");
const chrome = read("features/play/RoundChrome.tsx");
const panel = read("features/squareoff/QuestionPanel.tsx");
const shell = read("app/layout/Shell.tsx");
const guest = read("features/profile/GuestCard.tsx");

ok(/One go a day/.test(daily) && /<GuestCard bare \/>/.test(daily) && /I have an account/.test(daily), "signed out: one card, a name and Play, and a way in for members (#15)");
ok(/bare \? "Play" : "Start playing"/.test(guest), "the bare name form's button says Play");
ok(!/Timer|ROUND_MS|clock/i.test(daily.replace(/No clock[^\n]*\n[^\n]*/g, "")), "no clock while you answer (talk item 4, kept 26 Sep)");
ok(/useFocusMode\(/.test(daily) && /\{!focused && <header/.test(shell) && /\{!focused && <nav/.test(shell), "no header or tab bar while a round is in play (#16)");
ok(/<Link to="\/" aria-label="Leave\. Your answers count/.test(daily), "an X leads out, and says nothing is lost");
ok(/was === true \? "leaf" : was === false \? "ember" : i === index \? "petal"/.test(daily), "seeds: green right, red wrong, gold for this question");
ok(/Yes! \+\$\{gained\}/.test(chrome) && /Not this time/.test(chrome) && /sayParts\(parts\)/.test(chrome), "the verdict: Yes! +points with what they were for, or Not this time (#17, #18)");
ok(!/"Missed"|Correct {2}\+/.test(chrome), "no green or red slab shouting Correct or Missed");
ok(/answerShown/.test(daily) && /!correct && !answerShown/.test(chrome), "the right answer isn't repeated when the options already show it green");
ok(/"Right" : revealed && isMine \? "You"/.test(panel), "the options say Right and You (#17, #18)");
ok(!/opacity-40/.test(panel) && /bg-board\/55 \[&>\*\]:opacity-55/.test(panel), "the rest step back, .55 as drawn (an opacity class on the button never showed: the rise-in sets it inline)");
ok(!/7 out of 10|\$\{d\.mine\.correct\} out of 10/.test(daily) && /<Board rows=\{d\.board\}/.test(daily), "done: the card first, then everyone on the board (#19; everyone, Daramola 26 Sep)");

ok(/role="heading" aria-level=\{2\}\s+className="card /.test(panel) && /bg-sky-hi text-ink/.test(panel), "the question sits on a white card, the chip is ink on pale sky (#16)");

// The drawing's own numbers (its CSS: .q, .opt, .gain, .cut, .hud .score, .ttl),
// not ones read off a screenshot of it.
ok(/text-\[19px\] leading-\[1\.3\] font-bold/.test(panel), ".q: 700 19px/1.3");
ok(/px-3 py-\[11px\]/.test(panel) && /text-\[15px\] font-bold/.test(panel) && /size=\{22\}/.test(panel), ".opt: 11px 12px, 700 15px, 22px marks");
ok(/from-leaf-hi to-leaf/.test(panel) && /from-ember-hi to-ember/.test(panel), ".opt.right / .opt.wrong: top-lit gradients");
ok(/text-\[21px\]/.test(chrome) && /text-ember-lo/.test(chrome) && /min-h-\[52px\] font-display text-\[19px\] cut-petal/.test(chrome), ".gain b 21px (miss in ember-lo); Next .cut 52px, 19px");
ok(/font-mono text-\[16px\] font-bold/.test(daily) && /w-\[38px\] h-\[38px\]/.test(daily) && /w-3 h-3/.test(daily), ".hud: mono 16px score, 38px X, 12px seeds");
ok((daily.match(/text-\[29px\]/g) ?? []).length >= 2, ".ttl: 29px titles");

console.log(`${n} Daily assertions hold`);
