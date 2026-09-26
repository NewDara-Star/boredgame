/**
 * "Play it with…" (Daramola, 26 Sep): two board games, Tic Tac Toe and Connect
 * 4, each played with a challenge per spot chosen before the game (None,
 * Trivia, Cup toss, Hoops, Knock-down, or Mix, a different one each turn). A
 * miss leaves the spot open and passes the turn. Square Off, Catapult Squares,
 * Connect 4 Trivia and Connect 4 Catapult stop being games of their own.
 */
import { readFileSync, existsSync } from "node:fs";
import { nextMix, parseWith, isShot, CHALLENGES, roomSetup, roomWith, stepLevel, levelOf, mixStart, turnKindOf, type Play } from "../src/features/challenge/kinds.ts";
import { newGame, pick, answer, advance } from "../src/features/squareoff/rules.ts";

let n = 0;
const ok = (c: boolean, m: string) => { n++; if (!c) { console.error("FAIL " + m); process.exit(1); } };
const read = (p: string) => readFileSync(new URL("../" + p, import.meta.url), "utf8");

ok(CHALLENGES.map((c) => c.key).join() === "none,trivia,cup,hoops,knock,mix", "the six choices, in the drawing's order");
let prev = null as ReturnType<typeof nextMix> | null, repeats = 0, seen = new Set<string>();
for (let i = 0; i < 2000; i++) { const k = nextMix(prev); if (k === prev) repeats++; seen.add(k); prev = k; }
ok(repeats === 0 && seen.size === 4 && !seen.has("none"), "Mix deals trivia, cup toss, hoops or knock-down, never the same twice running");
ok(parseWith("hoops") === "hoops" && parseWith("catapult") === null && parseWith(null) === null, "?with= takes only a real choice");
ok(isShot("cup") && isShot("knock") && !isShot("trivia"), "the shots are the shots");
ok(roomSetup("tictactoe", "none").mode === "tictactoe" && roomSetup("tictactoe", "knock").mode === "squareoff"
   && roomSetup("connect4", "mix").mode === "connect4trivia" && roomSetup("connect4", "hoops").challenge === "hoops",
   "a room plays every choice: None is the plain board, anything else the board where a spot costs something");
ok(roomWith("connect4trivia", "hoops") === "hoops" && roomWith("tictactoe", "trivia") === "none" && roomWith("squareoff", "catapult") === "cup",
   "and reads back as what it was set to (an old catapult room plays cup toss)");

// The game picks each player's shot level (Daramola, 26 Sep): Normal to start,
// two misses running to Easy, two hits running back to Normal. One player's
// streak never moves the other's.
{
  let p: Play | null = null;
  p = stepLevel(p, "x", false); ok(levelOf(p, "x") === "norm", "one miss: still Normal");
  p = stepLevel(p, "o", true);  p = stepLevel(p, "x", false);
  ok(levelOf(p, "x") === "easy" && levelOf(p, "o") === "norm", "two misses running: Easy, for that player only");
  p = stepLevel(p, "x", true); ok(levelOf(p, "x") === "easy", "one hit on Easy: still Easy");
  p = stepLevel(p, "x", false); p = stepLevel(p, "x", true); ok(levelOf(p, "x") === "easy", "a miss breaks the run of hits");
  p = stepLevel(p, "x", true); ok(levelOf(p, "x") === "norm", "two hits running: back to Normal");
  p = stepLevel(p, "x", true); p = stepLevel(p, "x", true); ok(levelOf(p, "x") === "norm", "Normal is the top: hits don't go past it");
}
// Mix in a room: both phones agree on the turn's challenge before anyone writes one.
ok(mixStart(41) === mixStart(41) && turnKindOf("mix", null, 41) === mixStart(41) && turnKindOf("mix", { kind: "hoops" }, 41) === "hoops"
   && turnKindOf("cup", { kind: "hoops" }, 41) === "cup", "Mix's first turn comes from the room, then from what's written");

// A miss leaves the square open and passes the turn: no steal.
{
  const g = pick(newGame("x"), 4), missed = answer(g, false), after = advance(missed);
  ok(missed.board[4] === null && after.phase === "picking" && after.turn === "o", "a miss leaves the spot open and passes the turn");
}

const reg = read("src/features/play/registry.tsx"), app = read("src/app/App.tsx"), cat = read("src/features/play/CataloguePage.tsx");
for (const slug of ["squareoff", "catapultsquares", "connect4trivia", "connect4catapult"]) {
  const block = reg.slice(reg.indexOf(`slug: "${slug}"`), reg.indexOf("like:", reg.indexOf(`slug: "${slug}"`)));
  ok(/hidden: true/.test(block), `${slug} is off the Games list`);
}
ok((reg.match(/withs: true/g) ?? []).length === 2, "Tic Tac Toe and Connect 4 are played with a challenge");
ok(/const GAMES = ALL\.filter\(\(g\) => !g\.hidden\)/.test(cat), "the list and search show only the two");
ok(/"\/tictactoe\?with=trivia"/.test(app) && /"\/tictactoe\?with=cup"/.test(app) && /"\/connect4\?with=trivia"/.test(app) && /"\/connect4\?with=cup"/.test(app),
   "the old games' links land on the board with the challenge set");
ok(/Play it with/.test(cat) && /CHALLENGES\.map/.test(cat) && /writeWith\(g\.slug, c\)/.test(cat) && /\?with=\$\{w\}/.test(cat), "#14: Play it with, remembered, and passed to the board");

const hook = read("src/features/play/useSoloBoard.ts"), page = read("src/features/play/BoardSoloPage.tsx");
ok(/const kind = mixing \? turnKind/.test(hook) && /if \(kind === "trivia"\) dealQuestion\(\); else newTarget\(\);/.test(hook), "each turn deals what that turn costs");
ok(/BOT_ODDS\[kind\]\[shotLevel\]/.test(hook), "the bot lands its shots at set odds, so it can be beaten");
ok(/This one's \$\{challengeName/.test(page), "with Mix, the banner says the turn's challenge before the pick");
ok(/<ChallengeSheet/.test(page) && /<ShotPanel/.test(page) && /<MiniBoard/.test(page), "a spot opens the challenge sheet with the spot on a mini board");

const shots = read("src/features/challenge/shots.ts"), sheet = read("src/features/challenge/ChallengeSheet.tsx");
ok(/dyUp \/ \(H\(\) \* \.45\)/.test(shots), "a toss's power is the swipe's length, not its speed (fair for a child)");
ok(/"\/vendor\/matter-0\.19\.0\.min\.js"/.test(shots) && existsSync(new URL("../public/vendor/matter-0.19.0.min.js", import.meta.url)), "knock-down's physics is vendored and loaded on first use");
ok(/catch\(\(\) => run\("cup"\)\)/.test(sheet), "if it can't load, the turn is a cup toss, not a spot nobody can play for");
ok(/top-\[calc\(34px\+env\(safe-area-inset-top\)\)\]/.test(sheet) && /rounded-t-\[26px\]/.test(sheet), "the sheet is full height, 26px corners on top");
ok(/Back to the board/.test(sheet) && /"bloom" : "bored"/.test(sheet), "the result lands on the sheet with the flower, then goes");

// A throw always ends (Daramola, 26 Sep: the ball sat on the cup's rim for
// good, the rim sound going over and over). Play the real physics, no screen:
// every throw settles within five seconds, with at most five rim sounds.
{
  const { toss } = await import("../src/features/challenge/shots.ts");
  for (const kind of ["cup", "hoops"] as const) for (const level of ["norm", "easy"] as const) {
    let clock = 0, res: string | null = null, rims = 0, worstRims = 0, worstT = 0, unended = 0;
    const quiet = () => {};
    const E = { ctx: {} as CanvasRenderingContext2D, W: () => 390, H: () => 440, level, font: "", clock: () => clock,
      s: new Proxy({}, { get: (_, k) => (k === "rim" ? () => { rims++; } : quiet) }) as never,
      done: (_hit: boolean, big: string) => { res = big; }, hint: quiet, shake: quiet };
    const g = toss(kind, E); g.resize();
    for (let i = 0; i < 4000; i++) {
      g.turn(); res = null; rims = 0;
      const len = 30 + Math.random() * 260, slant = (Math.random() - .5) * len * .5;
      for (const y of [396, 352, 308, 418, 440]) g.down(195, y);
      g.move(195 + slant, 396 - len); g.up();
      let t = 0; while (res === null && t < 30) { g.update(1 / 60); t += 1 / 60; clock += 1 / 60; }
      if (res === null) unended++; worstT = Math.max(worstT, t); worstRims = Math.max(worstRims, rims);
    }
    ok(unended === 0 && worstT <= 5.1, `every ${kind} throw (${level}) ends: none left running, longest ${worstT.toFixed(1)}s`);
    ok(worstRims <= 5, `a ${kind} throw (${level}) rings the rim at most five times (worst ${worstRims})`);
  }
}

// A room's two phones see the same scene, and the watching one can draw the
// thrower's flight: the same seed deals the same cup and wind, and the frames
// written on one phone put the ball in the same place on the other.
{
  const { toss, seeded } = await import("../src/features/challenge/shots.ts");
  const env = (seed: number, w: number[], watch = false) => {
    let res: string | null = null; const quiet = () => {};
    const E = { ctx: {} as CanvasRenderingContext2D, W: () => 390, H: () => 440, level: "norm" as const, font: "", clock: () => 0,
      s: new Proxy({}, { get: () => quiet }) as never, rand: seeded(seed), watch,
      done: (_hit: boolean, big: string) => { res = big; }, hint: quiet, shake: quiet };
    return { E, res: () => res, w };
  };
  let same = 0, matched = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const a = env(seed, []), b = env(seed, [], true);
    const ga = toss("cup", a.E, (x) => a.w.push(x)), gb = toss("cup", b.E, (x) => b.w.push(x));
    ga.resize(); gb.resize(); ga.turn(); gb.turn();
    if (a.w[0] === b.w[0]) same++;
    // throw on a, writing a frame every 1/30 s as startShot does
    for (const y of [396, 352, 308, 418, 440]) ga.down(195, y);
    ga.move(195 + (seed % 7) * 6 - 18, 396 - (60 + seed % 180)); ga.up();
    const f: number[][] = []; let t = 0, acc = 0;
    while (a.res() === null && t < 6) { ga.update(1 / 60); t += 1 / 60; acc += 1 / 60; if (acc >= 1 / 30) { f.push(ga.snap()); acc -= 1 / 30; } }
    f.push(ga.snap());
    gb.show(f[f.length - 1]);
    const pa = ga.at(), pb = gb.at();
    if (pa && pb && Math.hypot(pa.x - pb.x, pa.y - pb.y) < 1) matched++;
  }
  ok(same === 200, `the same seed deals the same wind on both phones (${same}/200)`);
  ok(matched === 200, `a flight's last frame puts the ball in the same place on the other phone (${matched}/200)`);
}

const room = read("src/features/rooms/useBoardRoom.ts"), roomShot = read("src/features/challenge/RoomShot.tsx");
ok(/shot: rec \? \{ \.\.\.rec, seed, by: myMark \} : null/.test(room), "the thrower writes the flight with the turn it belongs to");
ok(/patch\.play = stepLevel\(before\?\.play, next\.last\.by, next\.last\.correct\)/.test(room), "every shot taken or timed out moves that player's level");
ok(/challenge === "mix" && !plain && next\.phase === "picking"[\s\S]{0,160}kind: nextMix\(kindNow\)/.test(room), "Mix deals each new turn's challenge and writes it");
ok(/2600 \+ flightMs/.test(room), "the board waits while the other phone plays the flight back");
ok(/flight\.seed === turn\.seed && !turn\.mine/.test(roomShot), "the watching phone plays only this turn's flight");
ok(/watch=\{!turn\.mine\}/.test(roomShot) && /tint=\{turn\.by === "x" \? "petal" : "sky"\}/.test(roomShot), "it can't touch the shot, and the ball is the thrower's colour");
ok(/Out of time/.test(roomShot), "a shot nobody took says so on both phones");

console.log(`${n} challenge assertions hold`);
