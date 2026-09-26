/**
 * Picking a game in a room picks exactly one game.
 *
 * A fresh room is `mode: squareoff, game: trivia, challenge: trivia`, and the
 * lobby once lit up TWO cards on it: Square Off, and Catapult Squares, the same
 * mode and board told apart only by what a move costs.
 *
 * Since Play it with (drawing 36b, 26 Sep) the lobby is tiles: Tic Tac Toe and
 * Connect 4 are one tile each whatever they're played with, and "Play it with"
 * is its own step. This holds that every row a room can hold lights exactly one
 * tile, that picking a tile or a chip writes a row that lights that tile and
 * reads back as that chip, and that the steps show only where they mean
 * something. Lobby.tsx is JSX, so its tile table is read out of the source.
 */
import { readFileSync } from "node:fs";
import { CHALLENGES, roomSetup, roomWith } from "../src/features/challenge/kinds.ts";

let n = 0;
const ok = (c: boolean, m: string) => {
  n++;
  if (!c) { console.error("FAIL " + m); process.exit(1); }
};

const lobby = readFileSync(new URL("../src/features/rooms/Lobby.tsx", import.meta.url), "utf8");

type Row = { mode: string; game: string; challenge: string };
interface Tile { slug: string; on: (r: Row) => boolean }
const table = lobby.slice(lobby.indexOf("const TILES: Tile[] = ["), lobby.indexOf("];", lobby.indexOf("const TILES")));
const tiles: Tile[] = [...table.matchAll(/\{ slug: "([a-z0-9]+)",[^}]*?on: \(r\) => ([^}]+?) \}/g)]
  .map((m) => ({ slug: m[1], on: new Function("r", `return ${m[2]};`) as (r: Row) => boolean }));
ok(tiles.length === 6, `the lobby's six tiles were read (${tiles.map((t) => t.slug).join(", ")})`);
ok(tiles[0].slug === "tictactoe" && tiles[1].slug === "connect4", "the two board games come first (36b)");

const lit = (r: Row) => tiles.filter((t) => t.on(r)).map((t) => t.slug);

// Every row the lobby can write, and every row an older app may have left.
const rows: Row[] = [];
for (const mode of ["tictactoe", "squareoff", "connect4", "connect4trivia", "memory", "ballsort", "race"])
  for (const game of ["trivia", "picto"])
    for (const challenge of ["trivia", "catapult", "cup", "hoops", "knock", "mix"]) rows.push({ mode, game, challenge });
for (const r of rows) {
  const on = lit(r);
  ok(on.length === 1, `${JSON.stringify(r)} lights exactly one tile, not ${on.length} (${on.join(", ")})`);
}
ok(lit({ mode: "squareoff", game: "trivia", challenge: "trivia" })[0] === "tictactoe", "a fresh room shows Tic Tac Toe selected");

// Picking a board and a chip writes a row that shows that board and that chip.
for (const board of ["tictactoe", "connect4"] as const)
  for (const c of CHALLENGES.map((x) => x.key)) {
    const w = roomSetup(board, c), row = { mode: w.mode, game: "trivia", challenge: w.challenge };
    ok(lit(row)[0] === board, `${board} with ${c} keeps ${board} lit`);
    ok(roomWith(row.mode, row.challenge) === c, `${board} with ${c} reads back as ${c}`);
  }
ok(roomWith("squareoff", "catapult") === "cup", "a room from before Play it with plays its catapult as a cup toss");

// The structural half: the steps show where they mean something.
ok(/\{board && \(\n\s*<motion\.section[\s\S]{0,200}· Play it with/.test(lobby), "Play it with shows only for the two boards");
ok(/const asks = board \? w === "trivia" \|\| w === "mix" : !!tile && tile\.bank;/.test(lobby),
   "questions show for a race, or a board with Trivia or Mix, and nowhere else");
ok(/onSetup\(r\.mode, "trivia"/.test(lobby), "a board draws its questions from the trivia bank");
ok(!/What does a move cost\?|"catapult", "A shot"/.test(lobby), "the old question-or-catapult step is gone");

console.log(`${n} lobby assertions hold`);
