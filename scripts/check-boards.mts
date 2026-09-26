/**
 * The board screens redrawn (#25–#30), built from the drawings' code, with
 * Daramola's calls of 26 Sep: between games the banner says who won with Next
 * game / End session under the board, and the X ends a session that has a
 * finished game (else goes back to the games).
 */
import { readFileSync } from "node:fs";

let n = 0;
const ok = (c: boolean, m: string) => { n++; if (!c) { console.error("FAIL " + m); process.exit(1); } };
const read = (p: string) => readFileSync(new URL("../src/" + p, import.meta.url), "utf8");
const page = read("features/play/BoardSoloPage.tsx");
const surface = read("features/play/PlaySurface.tsx");
const result = read("features/play/ResultScreen.tsx");
const ttt = read("features/squareoff/Board.tsx");
const c4 = read("features/connect4/Board.tsx");
const sqRules = read("features/squareoff/rules.ts");
const c4Rules = read("features/connect4/rules.ts");
const panel = read("features/squareoff/QuestionPanel.tsx");
const memory = read("features/memory/MemorySoloPage.tsx");

ok(/useFocusMode\(true\)/.test(page) && /<PlaySurface focus>/.test(page), "a board game has the whole phone (#25)");
ok(/<LeaveX onClick=\{leave\}/.test(page) && /<GameChip title=\{title\}/.test(page), ".tb: the X and the game's chip in its family colour");
ok(/s\.played > 0 \? s\.endSession\(\) : nav\("\/play"\)/.test(page), "the X ends a session with a finished game, else leaves (Daramola 26 Sep)");
ok(/text-\[22px\] leading-\[1\.05\]/.test(surface) && /from-petal-hi to-petal/.test(surface) && /size=\{48\}/.test(surface), ".turn: 22px display, gold or white, a 48px flower head");
ok(/"Your move"/.test(page) && /"The bot's thinking"/.test(page) && /"Land it in the ring"/.test(page), "whose move in words (#25, #27, #28)");
ok(/"You win this one"/.test(page) && />Next game</.test(page) && />End session</.test(page), "between games: the banner says it, Next game / End session under the board");
ok(/grid grid-cols-2 gap-\[9px\]/.test(surface) && /shadow-\[0_0_0_3px_var\(--color-petal\)/.test(surface) && /font-mono text-\[13px\]/.test(surface), ".seats: two cards, the one on ringed gold, the count in mono");
ok(!/i \+ 1\}<\/span>|\{c \+ 1\}/.test(ttt + c4), "no numbers in the squares or under the columns");
ok(/rounded-\[24px\]/.test(ttt) && /bg-mist/.test(ttt) && /w-\[66%\] h-\[66%\]/.test(ttt), ".board / .g3: white, 24px corners, mist squares, pieces at 66%");
ok(/width \* 0\.62/.test(ttt) && /shadow-\[inset_0_0_0_3px_var\(--color-ink-day\)\]/.test(ttt), "#26: the board drops to 62%, the square in play ringed in ink");
ok(/from-sky to-sky-lo/.test(c4) && /rounded-\[22px\]/.test(c4), ".c4: sky to sky-lo, 22px corners");
ok(/the \$\{SQUARE_NAMES\[n\]/.test(sqRules) && /the \$\{COLUMN_NAMES\[n\]/.test(c4Rules), "squares and columns named by where they are");
ok(/<TurnPanel sheet/.test(page) && /rounded-t-\[26px\]/.test(read("features/challenge/ChallengeSheet.tsx")) && /text-\[17px\] leading-\[1\.3\] font-bold/.test(panel), "#26: the question on the challenge sheet, 17px bold");
ok(/Is there another \$\{face\}\?/.test(memory), "#29: Pick one more / Is there another heart?");
ok(/<TurnBanner title=\{headline\}/.test(result) && /tone === "win" \? "petal" : "white"/.test(result) && !/bg-ember/.test(result), "#30: the result as a banner, no red slab");
ok(/"You beat the bot"/.test(page) && /New session/.test(page), "#30: in your words, then New session");

// At night the page's ink is white; every new surface is a .card so it gets
// ink back (index.css). The first build left the banner, seats and sheet blank.
ok(/className=\{`card shrink-0 flex items-center gap-2\.5 rounded-\[20px\]/.test(surface) && /className=\{`card flex items-center gap-2 bg-board/.test(surface) && /className="card fixed inset-x-0 bottom-0/.test(read("features/challenge/ChallengeSheet.tsx")), "banner, seats and sheet read at night (.card)");

console.log(`${n} board assertions hold`);
