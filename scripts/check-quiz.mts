/**
 * Solo quiz rounds redrawn (#20–#24), built from the drawings' code, with
 * Daramola's calls of 26 Sep: two hints that each take one wrong answer away
 * (−100 each), level and categories in one swipeable row above the first
 * question, a near miss shown and counted as a miss, and the summary as drawn
 * with the answers folded away.
 */
import { readFileSync, existsSync } from "node:fs";

let n = 0;
const ok = (c: boolean, m: string) => { n++; if (!c) { console.error("FAIL " + m); process.exit(1); } };
const read = (p: string) => readFileSync(new URL("../src/" + p, import.meta.url), "utf8");
const trivia = read("features/trivia/TriviaGame.tsx");
const picto = read("features/picto/PictoGame.tsx");
const chrome = read("features/play/RoundChrome.tsx");
const chips = read("features/play/QuizChips.tsx");
const round = read("features/play/useRound.ts");
const scoring = read("features/play/scoring.ts");

ok(/const HINTS = 2/.test(trivia) && /wrong\.slice\(0, r\.hintsUsed\)/.test(trivia) && /Hint · \{HINTS - r\.hintsUsed\} left/.test(trivia), "trivia: two hints, each takes one wrong answer away (#20)");
ok(/hintsUsed \* 100/.test(scoring), "a hint costs 100");
ok(!/50 \/ 50|burn two/.test(trivia), "the 50/50 is gone");
ok(/LEVELS\.map/.test(chips) && chips.indexOf("LEVELS.map") < chips.indexOf("categories.map") && /overflow-x-auto/.test(chips), "level first, then categories, in one row you swipe (#20)");
ok(/first && <div className="mt-\[4px\]">\{chips\}<\/div>/.test(trivia) && /first && <div className="mt-\[4px\]">\{chips\}<\/div>/.test(picto), "the chips show above the first question only");
ok(/levels\.includes\(i\.difficulty\)/.test(round) && /quizKey\("trivia"\)/.test(trivia) && /quizKey\("picto"\)/.test(picto), "the level deals the round and is remembered per game");
ok(!existsSync(new URL("../src/features/play/CategoryBar.tsx", import.meta.url)), "the folded filter panel is gone");
ok(/No \$\{lv\}\$\{cats\}questions yet/.test(chips) && /Clear the filters/.test(chips) && /<NothingMatches/.test(trivia) && /<NothingMatches/.test(picto), "filters that leave nothing say which, and one tap clears them (#24)");
ok(/state="bored" stem=\{false\} size=\{44\}/.test(chrome) && /So close/.test(chrome) && /You wrote "\{marked\(given, answer\)\}"/.test(chrome), "a near miss: the flower sighs, the answer, the difference marked (#22)");
ok(/near = !ok && !current\.choices/.test(round) && /const gained = parts\?\.total \?\? 0/.test(round), "…and it still scores nothing");
ok(/\{name\} · round done/.test(chrome) && /text-\[48px\]/.test(chrome) && /Seeds big/.test(chrome) && /right<\/p>/.test(chrome), "summary card: the game, the score at 48px counting up, big seeds, N of 10 right (#23)");
ok(/grid-cols-\[1\.35fr_1fr\]/.test(chrome) && /story=\{false\}/.test(chrome) && /cut-board min-h-\[52px\] font-display text-\[19px\]">Play again/.test(chrome), "Share, then Play again second (#23)");
ok(/See your answers/.test(chrome) && /<motion\.details/.test(chrome), "the answers folded away (Daramola 26 Sep)");
ok(/useFocusMode\(true\)/.test(trivia) && /useFocusMode\(true\)/.test(picto), "a round has the whole phone");
ok(/rounded-\[22px\] aspect-square mx-auto w-full/.test(picto) && /cut-petal shrink-0 min-h-\[42px\] px-3 font-display text-\[16px\]/.test(picto), "picto: the picture fills the width (.rebus), Go beside the box (.cut.sm) (#21)");
ok(/Skip for now/.test(picto), "Skip / Show me stay (talk item 5)");

console.log(`${n} quiz assertions hold`);
