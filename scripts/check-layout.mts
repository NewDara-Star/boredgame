/**
 * A game has to fit on the screen it is played on.
 *
 * The screen survey (STATUS.md) measured every page at 390×664 — a phone in
 * Safari, which is 534px of usable height once the header and the bottom bar
 * are off. Four game screens put the thing you were being asked to tap below
 * the fold: Square Off's answers by 227px, Connect 4 Trivia's by 274, and both
 * catapult modes cut the catapult itself in half. The board was always
 * visible; the control never was.
 *
 * The fix is structural — a play screen is a fixed-height column
 * (`PlaySurface`) whose board takes what is left (`PlayBoard`) rather than a
 * document that flows past the bottom of the phone. This file is what stops it
 * being undone by the next screen someone adds: it reads the source of every
 * page that draws a board and fails if the page is laid out by flow again, or
 * if a board is drawn without the width the screen measured for it.
 *
 * It cannot prove the pixels — that needs a browser, and scripts/survey-screens
 * .mjs is the thing that does it. It proves the shape the pixels come from.
 */
import { readFileSync } from "node:fs";

let n = 0;
const ok = (c: boolean, m: string) => {
  n++;
  if (!c) { console.error("FAIL " + m); process.exit(1); }
};
const read = (p: string) => readFileSync(new URL("../" + p, import.meta.url), "utf8");

/** every screen where a board or a puzzle is played */
const PLAY_SCREENS = [
  "src/features/play/BoardSoloPage.tsx",
  "src/features/squareoff/SquareOffRoom.tsx",
  "src/features/tictactoe/TicTacToeRoom.tsx",
  "src/features/connect4/Connect4Room.tsx",
  "src/features/memory/MemoryRoom.tsx",
  "src/features/sort/SortRaceRoom.tsx",
  "src/features/sort/SortSoloPage.tsx",
];

for (const p of PLAY_SCREENS) {
  const src = read(p);
  ok(src.includes("<PlaySurface>"), `${p}: is a play surface, not a document that flows`);
  ok(src.includes("<PlayBoard"), `${p}: gives its board the space that is left`);
  // A board inside a play surface must be told how wide it may be. Without it
  // the board sizes itself off the width of the phone and pushes the control
  // off the bottom — the exact bug the survey found.
  ok(/width=\{width(\s*-\s*\d+)?\}|\bwidth,/.test(src), `${p}: draws the board at the measured width`);
}

// The surface subtracts the app's own chrome. If those numbers stop matching
// the Shell, every play screen is wrong by the difference.
{
  const css = read("src/index.css");
  const shell = read("src/app/layout/Shell.tsx");
  ok(css.includes(".play-surface"), "the play surface is defined in one place");
  ok(/--chrome:\s*calc\(62px \+ 1rem \+ 5rem \+ 6px\)/.test(css),
     "the chrome is the header, main's padding and the bottom bar");
  ok(/h-\[62px\]/.test(shell), "the header is the 62px the chrome subtracts");
  ok(/pt-4 pb-20 sm:py-6/.test(shell), "main's padding is the 1rem and 5rem the chrome subtracts");
  ok(css.includes("100dvh"), "and it is the dynamic viewport, so Safari's bars are counted");
}

// PlayBoard's whole job: never taller than the space it was given.
{
  const src = read("src/features/play/PlaySurface.tsx");
  ok(src.includes("flex-1 min-h-0"), "the board's box may shrink below its content");
  ok(src.includes("ResizeObserver"), "and is measured rather than guessed at");
  ok(/Math\.min\(r\.width, r\.height \* ratio\)/.test(src), "fitting a board is a min of both dimensions");
}

// The result screens show the card, not a description of the card.
{
  const src = read("src/features/play/ResultScreen.tsx");
  ok(src.includes("play-surface"), "the result is one screen too");
  ok(src.includes("max-h-full"), "and the card is bounded by it");
  for (const p of ["src/features/play/BoardSoloPage.tsx", "src/features/rooms/matchUi.tsx"]) {
    ok(read(p).includes("<ResultScreen"), `${p}: uses the one result screen`);
  }
}

console.log(`${n} layout assertions hold`);
