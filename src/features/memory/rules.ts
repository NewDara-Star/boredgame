import {
  other, speaker, stallWriter as stall,
  type Mark, type Cell, type Phase, type Stall,
} from "../play/board.ts";

/**
 * Flip and match. Two tiles a turn; a pair scores and you go again.
 *
 * The one game in here where being eight is not a disadvantage — recall of
 * where a thing was is flat across ages, and a child on a run of matches keeps
 * the turn and runs away with it. That is the whole reason it is here.
 *
 * Same four phases as the boards, so the synced-row hook needs no special case:
 *   picking  — nothing face up, flip your first
 *   asking   — one face up, flip a second (the "question" is which tile)
 *   revealed — both face up, being looked at
 *   over     — every pair claimed
 *
 * Import-free so bare Node can check it.
 */

export { other, speaker, type Mark, type Cell, type Phase, type Stall };

export const PAIRS = 8;
export const SIZE = PAIRS * 2;      // 16 tiles, a 4x4 grid
export const COLS = 4;

/** Faces are content, not logic. Kept here so both clients render the same
    deck from the same stored string and nothing has to be fetched. */
export const FACES = ["🍉", "🚀", "🐙", "⚽", "🎸", "🍩", "🦊", "⭐"];

export interface Game {
  /** what each tile is, as an index into FACES */
  deck: number[];
  /** who has claimed each tile, or null while it is still in play */
  board: Cell[];
  turn: Mark;
  phase: Phase;
  /** the first tile of the current pair, while only one is face up */
  target: number | null;
  last: { by: Mark; a: number; b: number; correct: boolean } | null;
  winner: Mark | "draw" | null;
  /** the completed pair, for painting the winning tiles */
  line: number[] | null;
}


/** Fisher-Yates on a caller-supplied source of randomness, so a test can hand
    it a seeded one and get the same deck twice. */
export function shuffledDeck(rand: () => number = Math.random): number[] {
  const deck: number[] = [];
  for (let i = 0; i < PAIRS; i++) deck.push(i, i);
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

export function newGame(first: Mark = "x", rand: () => number = Math.random): Game {
  return {
    deck: shuffledDeck(rand),
    board: Array(SIZE).fill(null),
    turn: first,
    phase: "picking",
    target: null,
    last: null,
    winner: null,
    line: null,
  };
}

export const claimed = (g: Game, i: number) => g.board[i] !== null;

/** Face up right now: your first pick, or both of a pair being looked at. */
export function faceUp(g: Game): number[] {
  if (g.phase === "asking" && g.target !== null) return [g.target];
  if ((g.phase === "revealed" || g.phase === "over") && g.last) return [g.last.a, g.last.b];
  return [];
}

export const scoreOf = (g: Game, m: Mark) => g.board.filter((c) => c === m).length / 2;

function settle(g: Game, board: Cell[], last: Game["last"]): Game {
  const done = board.every((c) => c !== null);
  if (!done) return { ...g, board, last, phase: "revealed", target: null, line: null };
  const x = board.filter((c) => c === "x").length;
  const o = board.filter((c) => c === "o").length;
  return {
    ...g, board, last, phase: "over", target: null,
    winner: x === o ? "draw" : x > o ? "x" : "o",
    line: last ? [last.a, last.b] : null,
  };
}

/**
 * Turning a tile over. Both taps of a turn come through here — the first opens
 * the pair, the second closes it — so the caller never has to know which tap it
 * is holding, and an illegal tap returns the same object it was given.
 */
export function flip(g: Game, i: number): Game {
  if (g.phase !== "picking" && g.phase !== "asking") return g;
  if (i < 0 || i >= SIZE || claimed(g, i)) return g;

  if (g.phase === "picking") {
    return { ...g, phase: "asking", target: i, last: null, line: null };
  }
  // second tap: the same tile is not a pair, it is a mis-tap
  if (g.target === null || i === g.target) return g;

  const a = g.target;
  const matched = g.deck[a] === g.deck[i];
  const last = { by: g.turn, a, b: i, correct: matched };
  if (!matched) return { ...g, phase: "revealed", target: null, last, line: null };

  const board = g.board.slice();
  board[a] = g.turn;
  board[i] = g.turn;
  return settle(g, board, last);
}

/**
 * Done looking. A match keeps the turn — which is what lets a good memory run
 * away with the game, and is the reason this is worth playing.
 */
export function advance(g: Game): Game {
  if (g.phase !== "revealed" || !g.last) return g;
  return {
    ...g,
    phase: "picking",
    turn: g.last.correct ? g.turn : other(g.turn),
    target: null,
    last: null,
    line: null,
  };
}

/**
 * Closing a turn nobody finished.
 *
 * A memory turn resolves on the SECOND tap, so there is nothing here anyone
 * answers — this used to hand back the state it was given, purely so the
 * engine satisfied the same interface as the boards. That made it a no-op on
 * the one path that needs it: flip a tile, lock your phone, and the board sits
 * in `asking` with a second tap that is never coming and a rescue that writes
 * the same row back. Nothing moved, for either player, ever again.
 *
 * So it does the only sensible thing for an abandoned pair: the tile goes back
 * face down and the turn passes. `correct` is ignored — a pair nobody finished
 * is not a match — and it is kept in the signature because the shared hook
 * calls every engine the same way.
 */
export function answer(g: Game, _correct = false): Game {
  if (g.phase !== "asking" || g.target === null) return g;
  return { ...g, phase: "picking", turn: other(g.turn), target: null, last: null, line: null };
}

/** How many tiles back the bot can remember. A bot that recalls everything it
    has ever been shown wins 100% of the time against a person playing normally
    — measured, not guessed — which is not a game. Six is roughly a person. */
export const BOT_SPAN = 6;

/** Records a tile the bot has been shown. Re-inserted rather than overwritten
    so the map stays in order of most recently seen, which is what makes
    forgetting work. */
export function remember(seen: Map<number, number>, i: number, face: number) {
  seen.delete(i);
  seen.set(i, face);
}

/**
 * The bot. It only consults the last BOT_SPAN tiles it was shown, so it forgets
 * the way a person does — from the back — rather than by rolling dice, which
 * would let it remember a tile on one tap and forget it on the next.
 */
export function botFlip(
  g: Game, seen: Map<number, number>, rand: () => number = Math.random,
  span: number = BOT_SPAN,
): number {
  // slice(-0) is slice(0), which is the whole array — a bot asked to remember
  // nothing would have had perfect recall.
  const recent = span <= 0
    ? new Map<number, number>()
    : new Map([...seen.entries()].slice(-span));
  const open = g.board.map((c, i) => (c === null ? i : -1)).filter((i) => i >= 0);
  const hidden = open.filter((i) => i !== g.target);
  if (hidden.length === 0) return open[0] ?? -1;

  if (g.phase === "asking" && g.target !== null) {
    // Does it remember the partner of the tile it just turned over?
    const want = g.deck[g.target];
    const match = hidden.find((i) => recent.get(i) === want);
    if (match !== undefined) return match;
    return hidden[Math.floor(rand() * hidden.length)];
  }

  // Opening a turn: play a pair it already knows, if it knows one.
  const byFace = new Map<number, number[]>();
  for (const i of hidden) {
    const f = recent.get(i);
    if (f === undefined) continue;
    byFace.set(f, [...(byFace.get(f) ?? []), i]);
  }
  for (const [, tiles] of byFace) if (tiles.length >= 2) return tiles[0];

  // Otherwise prefer somewhere it has not looked, which is how a person plays.
  const fresh = hidden.filter((i) => !recent.has(i));
  const pool = fresh.length ? fresh : hidden;
  return pool[Math.floor(rand() * pool.length)];
}

/** One line of English for what just happened. */
export function describe(g: Game, names: Record<Mark, string>, you: Mark | null = null): string {
  const { mine, who, verb: s } = speaker(names, you);

  if (g.phase === "over") {
    if (g.winner === "draw") return "Every pair found — it's a draw.";
    const w = g.winner as Mark;
    return `${who(w)} ${s(w, "win")} it, ${scoreOf(g, w)} pairs to ${scoreOf(g, other(w))}.`;
  }
  if (g.phase === "revealed" && g.last) {
    const by = g.last.by;
    return g.last.correct
      ? `${who(by)} ${s(by, "find")} a pair — and ${s(by, "go")} again.`
      // "have" is irregular and the helper would make it "haves". Not worth a
      // table of exceptions for one word — the sentence uses a regular verb.
      : `No match. ${who(other(by))} ${s(other(by), "take")} a turn.`;
  }
  if (g.phase === "asking") {
    return mine(g.turn) ? "Now find its partner." : `${names[g.turn]} is looking for a partner.`;
  }
  return mine(g.turn) ? "Your turn — turn a tile over." : `${names[g.turn]} is turning tiles.`;
}

/* ------------------------------------------------------- abandonment */

/**
 * Who unsticks a memory board that has stopped moving.
 *
 * This was missing, on the reasoning that "every phase is written by the
 * player whose turn it is, and advance from a reveal is the same for both of
 * them". The second half is not true: `useBoardRoom` guards its reveal timer
 * and its advanceNow on `last.by === myMark`, so the pause that turns two
 * tiles back over is a setTimeout in ONE tab. A locked phone suspends it and
 * the board freezes for both players with nothing running anywhere — the same
 * bug Square Off had, in a game that never got the fix.
 *
 * Two ways to strand it, and both need an owner:
 *
 *   asking   — one tile up and no second tap coming. `answer()` closes it.
 *   revealed — two tiles up and nobody turning them back. `advance()` does.
 *
 * The `asking` deadline is an away deadline, not a rule: there is no shot
 * clock on looking at a grid and there should not be one. Exactly one mark is
 * named at any instant, which is what the check script holds it to.
 */
export function stallWriter(
  g: Pick<Game, "phase" | "turn" | "last">,
  elapsed: number,
  ms: { ask: number; reveal: number; grace: number },
): Stall | null {
  return stall(g, g.phase === "asking" ? g.turn : null, elapsed, ms);
}
