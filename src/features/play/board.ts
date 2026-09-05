/**
 * What every board reducer needs and none of them should own.
 *
 * The three rules modules — Square Off, Connect 4, Memory — each carried their
 * own copy of a mark, a turn flip, an English conjugator and a stall deadline,
 * because a rules module "may not import another one". That was never a real
 * constraint: it came from `allowImportingTsExtensions: false`, which meant an
 * import path could not carry the `.ts` extension that bare Node needs to run
 * the check scripts. The flag is on now, imports here are relative and carry
 * the extension, and tsc, Vite and bare Node all resolve them.
 *
 * The cost of the old rule was not abstract. "miss" + "s" is "misss" and "go"
 * + "s" is "gos", and both bugs had to be found and fixed in three files.
 *
 * This module imports nothing, which is the constraint that actually matters.
 */

export type Mark = "x" | "o";
export type Cell = Mark | null;

/** picking → asking → revealed → over. Shared because `useBoardRoom` reads it
    off every game and deals a question exactly when it says `asking`. */
export type Phase = "picking" | "asking" | "revealed" | "over";

export const other = (m: Mark): Mark => (m === "x" ? "o" : "x");

/**
 * Third-person -s, with the two endings that actually came up.
 *
 * English adds -es after a sibilant or an o. This is handed "miss" and "go" on
 * the most-seen lines in the app, and shipped "Dara misss" and "the bot gos"
 * before anything checked it.
 */
export const conjugate = (verb: string) =>
  /(s|sh|ch|x|z|o)$/.test(verb) ? `${verb}es` : `${verb}s`;

/**
 * The narrator every board describes itself with. `you` is the mark the reader
 * is playing, so one rules engine writes "You miss" for one player and "Dara
 * misses" for the other watching the same room.
 */
export function speaker(names: Record<Mark, string>, you: Mark | null) {
  const mine = (m: Mark) => m === you;
  return {
    mine,
    who: (m: Mark) => (mine(m) ? "You" : names[m]),
    verb: (m: Mark, v: string) => (mine(m) ? v : conjugate(v)),
  };
}

export type Stall = { mark: Mark; action: "timeout" | "advance" };

/**
 * Who may write a transition its owner has not.
 *
 * Every phase is written by exactly one client, so a player who locks their
 * phone takes their half of the game with them. Each deadline names its owner
 * first and, after a grace period, the opponent — never both, which is the
 * property the check scripts assert across the whole timeline.
 *
 * `answerer` is the difference between the games: Square Off hands a missed
 * question to the opponent, so it is not always whoever's turn it is. Connect 4
 * has no steal. Passing it in is the whole of what used to be two copies.
 */
export function stallWriter(
  g: { phase: Phase; last: { by: Mark } | null },
  answerer: Mark | null,
  elapsed: number,
  ms: { ask: number; reveal: number; grace: number },
): Stall | null {
  if (g.phase === "asking" && answerer) {
    if (elapsed >= ms.ask + ms.grace) return { mark: other(answerer), action: "timeout" };
    if (elapsed >= ms.ask) return { mark: answerer, action: "timeout" };
    return null;
  }
  if (g.phase === "revealed" && g.last) {
    const owner = g.last.by;
    if (elapsed >= ms.reveal + ms.grace) return { mark: other(owner), action: "advance" };
    if (elapsed >= ms.reveal) return { mark: owner, action: "advance" };
    return null;
  }
  // A pick has no deadline: there is no correct square to choose on someone
  // else's behalf, so an abandoned pick ends the match rather than resolving.
  return null;
}
