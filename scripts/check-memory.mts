/**
 * Memory runs on two phones off one row, so the reducer is the referee. The
 * properties that matter: a deck is always a full set of pairs, a match keeps
 * the turn, and the bot forgets enough to be beaten.
 */
import {
  PAIRS, SIZE, FACES, newGame, shuffledDeck, flip, advance, answer, stallWriter,
  faceUp, scoreOf, botFlip, remember, BOT_SPAN, describe, other, claimed,
  type Game, type Mark,
} from "../src/features/memory/rules.ts";

let failed = 0;
const ok = (name: string, cond: boolean) => {
  if (!cond) { console.error("  FAIL  " + name); failed++; } else console.log("  ok    " + name);
};
let s = 991;
const rnd = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;

console.log("the deck");
{
  ok("there are enough faces for the pairs", FACES.length >= PAIRS);
  ok("the board is two tiles per pair", SIZE === PAIRS * 2);
  for (let i = 0; i < 300; i++) {
    const d = shuffledDeck(rnd);
    ok_quiet(d.length === SIZE, "deck is a full board");
    const counts = new Map<number, number>();
    for (const f of d) counts.set(f, (counts.get(f) ?? 0) + 1);
    ok_quiet(counts.size === PAIRS, "every face is present");
    ok_quiet([...counts.values()].every((n) => n === 2), "exactly twice each");
  }
  ok("every shuffle is a complete set of pairs", true);
  // a seeded shuffle repeats; an unseeded one moves
  const seeded = () => { let t = 5; return () => (t = (t * 48271) % 2147483647) / 2147483647; };
  ok("the same seed deals the same deck",
     shuffledDeck(seeded()).join() === shuffledDeck(seeded()).join());
  const many = new Set(Array.from({ length: 200 }, () => shuffledDeck(rnd).join()));
  ok("and different ones do not all deal the same", many.size > 190);
}

function ok_quiet(cond: boolean, name: string) { if (!cond) { console.error("  FAIL  " + name); failed++; } }

console.log("\nturning tiles over");
{
  const g = newGame("x", rnd);
  ok("nothing starts face up", faceUp(g).length === 0);
  const one = flip(g, 5);
  ok("the first tap opens a pair", one.phase === "asking" && one.target === 5);
  ok("and shows exactly that tile", faceUp(one).join() === "5");
  ok("tapping the same tile again is a mis-tap, not a pair", flip(one, 5) === one);
  ok("a tile off the board changes nothing",
     flip(g, -1) === g && flip(g, SIZE) === g);
  ok("nothing is claimed yet", one.board.every((c) => c === null));
}

console.log("\na pair, and a miss");
{
  const g = newGame("x", rnd);
  const a = 0;
  const partner = g.deck.findIndex((f, i) => i !== a && f === g.deck[a]);
  const dud = g.deck.findIndex((f) => f !== g.deck[a]);

  const matched = advance(flip(flip(g, a), partner));
  ok("a match claims both tiles",
     matched.board[a] === "x" && matched.board[partner] === "x");
  ok("and the same player goes again", matched.turn === "x");
  ok("the score counts pairs, not tiles", scoreOf(matched, "x") === 1);

  const missed = flip(flip(g, a), dud);
  ok("a miss claims nothing", missed.board.every((c) => c === null));
  ok("it pauses with both tiles up", missed.phase === "revealed" && faceUp(missed).length === 2);
  ok("and then the turn passes", advance(missed).turn === "o");
  ok("the tiles go back down", faceUp(advance(missed)).length === 0);
  ok("advancing from anywhere else changes nothing", advance(g) === g);
}

console.log("\na whole game");
{
  for (let round = 0; round < 200; round++) {
    let g = newGame(round % 2 ? "o" : "x", rnd);
    const seen = new Map<number, number>();
    let guard = 0;
    while (g.phase !== "over" && guard++ < 400) {
      if (g.phase === "revealed") { g = advance(g); continue; }
      const i = botFlip(g, seen, rnd);
      remember(seen, i, g.deck[i]);
      const before = g;
      g = flip(g, i);
      ok_quiet(g !== before, "the bot never picks a tile it cannot turn over");
      ok_quiet(!claimed(before, i), "and never one already claimed");
    }
    ok_quiet(g.phase === "over", "a game always finishes");
    ok_quiet(g.board.every((c) => c !== null), "with every tile claimed");
    ok_quiet(scoreOf(g, "x") + scoreOf(g, "o") === PAIRS, "and every pair accounted for");
    const x = scoreOf(g, "x"), o = scoreOf(g, "o");
    ok_quiet(g.winner === (x === o ? "draw" : x > o ? "x" : "o"), "the winner is whoever has more");
  }
  ok("200 games finish with every pair claimed and the right winner", true);
}

console.log("\nthe bot forgets enough to be beatable");
{
  // "Beats a random player" says almost nothing — any memory at all beats none.
  // The question is whether a person who remembers MORE than it does can win,
  // because that is what an eight-year-old on a good day actually is.
  const play = (spanX: number, spanO: number) => {
    let g = newGame("x", rnd);
    const sx = new Map<number, number>(), so = new Map<number, number>();
    let guard = 0;
    while (g.phase !== "over" && guard++ < 400) {
      if (g.phase === "revealed") {
        // both players watch both tiles turn over — that is the whole game
        if (g.last) for (const t of [g.last.a, g.last.b]) {
          remember(sx, t, g.deck[t]); remember(so, t, g.deck[t]);
        }
        g = advance(g); continue;
      }
      const me = g.turn === "x" ? sx : so;
      const span = g.turn === "x" ? spanX : spanO;
      const i = botFlip(g, me, rnd, span);
      remember(sx, i, g.deck[i]); remember(so, i, g.deck[i]);
      g = flip(g, i);
    }
    return g.winner;
  };
  const rate = (a: number, b: number, n = 400) => {
    let wins = 0;
    for (let i = 0; i < n; i++) if (play(a, b) === "o") wins++;
    return wins / n;
  };

  const vsBlind = 1 - rate(BOT_SPAN, 0);          // bot as x, blind as o
  ok(`a memory beats no memory (${(vsBlind * 100).toFixed(0)}%)`, vsBlind > 0.55);

  const even = rate(BOT_SPAN, BOT_SPAN);
  ok(`two equal memories are an even game (${(even * 100).toFixed(0)}%)`,
     even > 0.35 && even < 0.65);

  const vsBetter = rate(BOT_SPAN, 99);            // bot as x, perfect recall as o
  ok(`someone who remembers more than it does wins more (${(vsBetter * 100).toFixed(0)}%)`,
     vsBetter > 0.55);

  ok("its memory is a span, not a dice roll — the same tile is not remembered then forgotten",
     (() => {
       const g2 = newGame("x", rnd);
       const seen2 = new Map<number, number>();
       for (let i = 0; i < BOT_SPAN; i++) remember(seen2, i, g2.deck[i]);
       const asking = { ...g2, phase: "asking" as const, target: 0 };
       const first = botFlip(asking, seen2, () => 0.5);
       return botFlip(asking, seen2, () => 0.5) === first;
     })());
}

console.log("\nthe sentence under the board");
{
  const names = { x: "You", o: "mariam" };
  const g = newGame("x", rnd);
  const a = 0;
  const dud = g.deck.findIndex((f) => f !== g.deck[a]);
  const missed = flip(flip(g, a), dud);
  const line = describe(missed, names, "x");
  ok("a miss hands over in English", line.includes("mariam takes a turn"));
  ok("and never mangles a verb", !/misss|haves|gos\b|takess/.test(line));
  const partner = g.deck.findIndex((f, i) => i !== a && f === g.deck[a]);
  const hit = describe(flip(flip(g, a), partner), names, "x");
  ok("your own match reads as yours", hit.startsWith("You find a pair"));
  const theirs = describe({ ...flip(flip(g, a), partner), last: { by: "o", a, b: partner, correct: true } },
                          names, "x");
  ok("theirs is conjugated", theirs.includes("mariam finds a pair") && theirs.includes("goes again"));
}

console.log("\na board nobody is left to move");
{
  // This room shipped with no rescue at all, on the reasoning that every phase
  // is written by whoever's turn it is. That is true and it is the problem:
  // the pause that turns two tiles back over is a setTimeout in ONE tab, and a
  // locked phone froze the board for both players with nothing running
  // anywhere. Both ways to strand it now have an owner.
  const MS = { ask: 90_000, reveal: 4500, grace: 6000 };
  const at = (g: Parameters<typeof stallWriter>[0], t: number) => {
    const w = stallWriter(g, t, MS);
    return w ? `${w.mark}:${w.action}` : null;
  };
  const g0 = newGame("x", rnd);
  const oneUp = flip(g0, 0);                       // x turned a tile and left
  ok("one tile up is an asking phase", oneUp.phase === "asking" && oneUp.target === 0);

  const pair = g0.deck.findIndex((f, i) => i !== 0 && f === g0.deck[0]);
  const wrong = g0.deck.findIndex((f, i) => i !== 0 && f !== g0.deck[0]);
  const missed = flip(oneUp, wrong);               // two tiles up, no match
  ok("a mismatch leaves a reveal", missed.phase === "revealed");

  ok("nobody writes while the away deadline runs",
     at(oneUp, 0) === null && at(oneUp, MS.ask - 1) === null);
  ok("a stranded tile is the flipper's to close first", at(oneUp, MS.ask) === "x:timeout");
  ok("and the opponent's once the grace is up",
     at(oneUp, MS.ask + MS.grace) === "o:timeout");
  ok("a stuck reveal is the flipper's first", at(missed, MS.reveal) === "x:advance");
  ok("and the opponent's after the grace", at(missed, MS.reveal + MS.grace) === "o:advance");
  ok("a frozen board always resolves eventually", at(missed, 10 * 60_000) !== null);
  ok("never two writers at once", (() => {
    for (const g of [oneUp, missed]) {
      for (let t = 0; t <= MS.ask + MS.grace * 3; t += 311) {
        const w = stallWriter(g, t, MS);
        if (w && w.mark !== "x" && w.mark !== "o") return false;
        if (w && w.action !== "timeout" && w.action !== "advance") return false;
      }
    }
    return true;
  })());

  // The rescue writes engine.answer() for a timeout. That used to hand back the
  // state it was given, so the rescue wrote the same row and nothing moved —
  // the deadline fired and the board stayed stuck. It has to actually close.
  const closed = answer(oneUp, false);
  ok("closing a stranded tile turns it back over", closed.phase === "picking" && closed.target === null);
  ok("and passes the turn", closed.turn === "o");
  ok("and claims nothing", closed.board.every((c) => c === null));
  ok("closing is only for a stranded tile",
     answer(g0, false) === g0 && answer(missed, false) === missed);

  // and the reveal rescue writes advance(), which must move for either player
  const moved = advance(missed);
  ok("advancing a stuck reveal turns the tiles back", moved.phase === "picking" && moved.last === null);
  ok("and passes the turn on a miss", moved.turn === "o");

  // a matched pair keeps the turn, so the rescue must not steal it
  const made = flip(oneUp, pair);
  if (made.phase === "revealed") {
    ok("a matched pair keeps the turn through the rescue", advance(made).turn === "x");
  } else {
    ok("a matched pair that ends the game needs no rescue", made.phase === "over");
  }

  // a finished game and a fresh pick have no deadline at all
  ok("no deadline on a pick or a finished board",
     at(g0, 99_999) === null
     && at({ ...g0, phase: "over" as const }, 99_999) === null);
}

console.log("\nmisc");
ok("other() flips", other("x") === "o" && other("o") === "x");

console.log(failed === 0 ? "\nall rules hold" : `\n${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);
