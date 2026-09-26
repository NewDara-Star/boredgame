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
ok(/var\(--color-leaf\)/.test(daily) && /var\(--color-ember\)/.test(daily) && /i === index \? "var\(--color-petal\)"/.test(daily), "seeds: green right, red wrong, gold for this question");
ok(/Yes! \+\$\{gained\}/.test(chrome) && /Not this time/.test(chrome) && /sayParts\(parts\)/.test(chrome), "the verdict: Yes! +points with what they were for, or Not this time (#17, #18)");
ok(!/"Missed"|Correct {2}\+/.test(chrome), "no green or red slab shouting Correct or Missed");
ok(/answerShown/.test(daily) && /!correct && !answerShown/.test(chrome), "the right answer isn't repeated when the options already show it green");
ok(/"Right" : revealed && isMine \? "You"/.test(panel), "the options say Right and You (#17, #18)");
ok(!/opacity-40/.test(panel) && /bg-board\/50 text-soft/.test(panel), "the rest step back (an opacity class never showed: the rise-in sets it inline)");
ok(!/7 out of 10|\$\{d\.mine\.correct\} out of 10/.test(daily) && /<Board rows=\{d\.board\}/.test(daily), "done: the card first, then everyone on the board (#19; everyone, Daramola 26 Sep)");

ok(/role="heading" aria-level=\{2\} className="card /.test(panel) && /bg-sky-hi text-ink/.test(panel), "the question sits on a white card, the chip is ink on pale sky (#16)");

console.log(`${n} Daily assertions hold`);
