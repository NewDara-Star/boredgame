import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/shared/lib/supabase";
import { loadContent, shuffle } from "@/features/play/content";
import type { PlayItem } from "@/features/play/types";
import { deal } from "@/features/play/dealer";
import { scopePool, emptyReason, type Scope } from "@/features/play/scope";
export type { Scope };
import { attempt } from "@/shared/lib/write";

export type Mark = "x" | "o";
export type Phase = "picking" | "asking" | "revealed" | "over";

/** Everything this hook needs to know about a game state. Both rules modules
    already satisfy it — c4's `last` carries a column and Square Off's carries a
    square and a steal flag, and neither is any of this file's business. */
export interface BoardState {
  board: (Mark | null)[];
  phase: Phase;
  turn: Mark;
  last: { by: Mark; correct: boolean } | null;
  winner: Mark | "draw" | null;
}

/** The stored row, minus whatever shape the board itself is stored in. */
export interface BoardRow {
  room_id: number;
  turn: Mark;
  winner: Mark | "draw" | null;
  puzzle_id: number | null;
  x_player: string | null;
  o_player: string | null;
  updated_at: string;
}

/**
 * The differences between two board games, and nothing else. Square Off and
 * Connect 4 had a hook each, 234 and 223 lines, whose subscription, optimistic
 * write, win booking, quit, reopen and start were identical to four significant
 * figures — and the realtime publication bug that made every Connect 4 move
 * invisible to the opponent was exactly the kind of thing that hides in a copy.
 */
export interface BoardEngine<G extends BoardState, R extends BoardRow> {
  table: string;
  /** realtime channel prefix, only so two channels never collide */
  channel: string;
  decode(row: R): G;
  encode(g: G): Record<string, unknown>;
  newGame(first: Mark): G;
  /** The plain move: take the square, drop the disc. No question. */
  place(g: G, cell: number): G;
  /** The trivia move: name what you are going for, the question follows. */
  pick(g: G, cell: number): G;
  answer(g: G, correct: boolean): G;
  advance(g: G): G;
  /**
   * Who owes the pending answer. Square Off hands it to the opponent on a miss
   * — the steal — so it is not always whoever's turn it is. Connect 4 has no
   * steal, so it always is.
   */
  answerer(g: G): Mark | null;
  /** Where the bot would move. Deliberately not a solved player in either game
      — win, block, take the middle, otherwise loose. A perfect Tic Tac Toe
      opponent draws every single time, which is not a game. */
  botCell(board: (Mark | null)[], me: Mark, rand?: () => number): number;
  /** One line of English for what just happened. The board alone is not
      legible: it cannot say "you missed, so the bot gets one shot at it". */
  describe(g: G, names: Record<Mark, string>, you: Mark | null): string;
}

export function useBoardRoom<G extends BoardState, R extends BoardRow>(
  engine: BoardEngine<G, R>,
  roomId: number | null,
  userId: string | undefined,
  scope: Scope | null = null,
  /** No questions at all: taking the square is the whole move. */
  plain = false,
  /** What the asking phase asks for. A catapult turn deals no puzzle — the
      target comes from the seed both clients already share. */
  challenge: "trivia" | "catapult" = "trivia",
) {
  const [row, setRow] = useState<R | null>(null);
  // Mirrors `row` so `write` can revert a failed move without taking `row` as a
  // dependency — `write` has to keep a stable identity or the reveal timer,
  // which depends on it, restarts every time the row changes.
  const rowRef = useRef<R | null>(null);
  const remember = useCallback((next: R | null) => { rowRef.current = next; setRow(next); }, []);
  const [pool, setPool] = useState<PlayItem[]>([]);
  const seen = useRef<Set<string>>(new Set());
  const lastServed = useRef<string | null>(null);
  const [poolError, setPoolError] = useState<string | null>(null);
  const [writeError, setWriteError] = useState<string | null>(null);

  useEffect(() => {
    if (plain || challenge !== "trivia") return;   // nothing to ask, nothing to fetch
    void loadContent("trivia").then((all) =>
      setPool(shuffle(all.filter((i) => i.choices && i.choices.length >= 2 && /^\d+$/.test(i.id)))));
  }, [plain, challenge]);

  useEffect(() => {
    if (!supabase || !roomId) return;
    let channel: ReturnType<NonNullable<typeof supabase>["channel"]> | null = null;
    let cancelled = false;
    (async () => {
      const { data } = await supabase!.from(engine.table).select("*").eq("room_id", roomId).maybeSingle();
      if (cancelled) return;
      remember((data as R | null) ?? null);
      channel = supabase!
        .channel(`${engine.channel}:${roomId}`)
        .on("postgres_changes",
          { event: "*", schema: "public", table: engine.table, filter: `room_id=eq.${roomId}` },
          (p) => remember(p.new as R))
        .subscribe();
    })();
    return () => { cancelled = true; if (channel) void supabase!.removeChannel(channel); };
  }, [roomId, remember, engine.table, engine.channel]);

  const game: G | null = row ? engine.decode(row) : null;
  const myMark: Mark | null =
    !row || !userId ? null : row.x_player === userId ? "x" : row.o_player === userId ? "o" : null;
  const item = row?.puzzle_id != null
    ? pool.find((i) => i.id === String(row.puzzle_id)) ?? null
    : null;

  // Memoised on the scope's CONTENT, not its identity. The room row is replaced
  // on every realtime tick, so a `{categories, difficulty}` built in the parent
  // is a new object each render — and a changing nextPuzzleId changes `write`,
  // which restarts the reveal timer that depends on it, forever.
  const scopeKey = JSON.stringify([scope?.categories ?? null, scope?.difficulty ?? null]);

  const nextPuzzleId = useCallback(() => {
    const scoped = scopePool(pool, scope ?? {});
    // An empty scope is a misconfigured room, not a reason to quietly serve from
    // the whole bank as if the filter had never been set.
    if (scoped.length === 0) {
      setPoolError(emptyReason(scope ?? {}, pool.length === 0));
      return null;
    }
    setPoolError(null);
    const { item: q } = deal(scoped, (i) => i.id, seen.current, { avoid: lastServed.current });
    if (!q) return null;
    lastServed.current = q.id;
    return Number(q.id);
  }, [pool, scopeKey]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Write a transition. Whether a question is dealt is read off the state
   * itself — a state that is `asking` needs one, and nothing else does. It used
   * to be a boolean each caller passed, and Connect 4 passed it wrongly at three
   * call sites, dealing a question for a phase that never asks one.
   */
  const write = useCallback(async (next: G) => {
    if (!supabase || !roomId) return;
    const patch: Record<string, unknown> = {
      ...engine.encode(next), updated_at: new Date().toISOString(),
    };
    if (next.phase === "asking") {
      patch.puzzle_id = challenge === "trivia" ? nextPuzzleId() : null;
    }

    // Apply it here first. Waiting for the write AND the realtime echo before
    // showing your own move meant every tap cost a round trip plus a push before
    // anything on your screen moved — and if realtime hiccupped, nothing moved
    // at all. Realtime is the confirmation now, not the trigger.
    const before = rowRef.current;
    if (before) remember({ ...before, ...patch } as R);

    const msg = await attempt("That move",
      supabase.from(engine.table).update(patch).eq("room_id", roomId));
    setWriteError(msg);
    // A refused move must not leave a board on screen that no one else can see.
    if (msg && before) remember(before);
  }, [roomId, nextPuzzleId, remember, engine, challenge]);

  /** The client that wrote the winning move books the win, so the tally moves
      exactly once however many browsers are watching. Incremented in the
      database rather than read-modify-written from this client's copy of the
      players list, which can lag realtime across a rematch. */
  const bookWin = useCallback(async (next: G) => {
    if (next.phase !== "over" || !next.winner || next.winner === "draw") return;
    const r = rowRef.current;
    if (!supabase || !r || !roomId) return;
    const seat = next.winner === "x" ? r.x_player : r.o_player;
    if (!seat) return;
    setWriteError(await attempt("Recording the win",
      supabase.rpc("bump_room_score", { p_room: roomId, p_user: seat })));
  }, [roomId]);

  const apply = useCallback(async (next: G) => {
    await write(next);
    await bookWin(next);
  }, [write, bookWin]);

  const choose = useCallback((cell: number) => {
    if (!game || myMark !== game.turn || game.phase !== "picking") return;
    const next = plain ? engine.place(game, cell) : engine.pick(game, cell);
    if (next === game) return;               // full column, taken square: nothing happened
    void apply(next);
  }, [game, myMark, plain, apply, engine]);

  const submit = useCallback((correct: boolean) => {
    if (!game || game.phase !== "asking" || engine.answerer(game) !== myMark) return;
    void apply(engine.answer(game, correct));
  }, [game, myMark, apply, engine]);

  /** Move on now rather than sitting out the pause. The timer stays as the
      fallback so an idle player cannot stall the board, but a pause you can
      skip is the difference between a game that feels quick and one that does
      not — a shorter fixed timer is not the same thing. */
  const advanceNow = useCallback(() => {
    if (!game || game.phase !== "revealed" || !game.last || game.last.by !== myMark) return;
    void write(engine.advance(game));
  }, [game, myMark, write, engine]);

  /** Writes the miss for a question nobody answered — including when the person
      who owed it has closed the tab. Callers must check stallWriter() first. */
  const forceTimeout = useCallback(() => {
    if (!game || game.phase !== "asking") return;
    void write(engine.answer(game, false));
  }, [game, write, engine]);

  /** Moves on from a reveal its owner never wrote. The pause below is a
      setTimeout in that player's tab, so a locked phone, an app switch or a
      backgrounded laptop suspends it and the board freezes for both players
      with nothing else running anywhere. Unguarded on purpose — the caller is
      whichever client stallWriter() named, which is not always the answerer. */
  const forceAdvance = useCallback(() => {
    if (!game || game.phase !== "revealed" || !game.last) return;
    void write(engine.advance(game));
  }, [game, write, engine]);

  /** Ends the session rather than the game. Rematch keeps the tally; this stops
      it. Through an RPC because the UPDATE policy on rooms is host-only — as a
      direct update this matched zero rows for the guest and said nothing. */
  const quit = useCallback(async () => {
    if (!supabase || !roomId) return;
    setWriteError(await attempt("Ending the match",
      supabase.rpc("end_match", { p_room: roomId })));
  }, [roomId]);

  /** Back to the lobby with the same code and the same two people, so a
      different game does not cost a new room. Clearing the other player's ready
      flag is not something RLS lets a client do, hence the RPC. */
  const changeGame = useCallback(async () => {
    if (!supabase || !roomId) return;
    setWriteError(await attempt("Reopening the room",
      supabase.rpc("reopen_room", { p_room: roomId })));
  }, [roomId]);

  // The player who just answered owns the move on, so exactly one client writes it.
  useEffect(() => {
    if (plain || !game || game.phase !== "revealed" || !game.last || game.last.by !== myMark) return;
    // A correct answer has nothing to read; a miss has the right answer and
    // sometimes an explanation. One fixed pause served neither.
    const pause = challenge !== "trivia" ? 1200
      : game.last.correct ? 1300 : item?.explanation ? 2900 : 2200;
    const t = setTimeout(() => void write(engine.advance(game)), pause);
    return () => clearTimeout(t);
  }, [plain, game, myMark, write, engine, item?.explanation, challenge]);

  const rematch = useCallback(async () => {
    if (!supabase || !roomId || !row) return;
    // Loser starts the next one. After a draw, alternate off whoever started
    // last rather than defaulting to x every time.
    const first: Mark = row.winner === "x" ? "o"
      : row.winner === "o" ? "x"
      : row.turn === "x" ? "o" : "x";
    setWriteError(await attempt("Starting the rematch",
      supabase.from(engine.table)
        .update({ ...engine.encode(engine.newGame(first)), puzzle_id: null })
        .eq("room_id", roomId)));
  }, [roomId, row, engine]);

  return {
    game, myMark, item, choose, submit, rematch, quit, changeGame,
    forceTimeout, forceAdvance, advanceNow,
    error: poolError ?? writeError,
    /** A plain or catapult game is never waiting for content — it has none. */
    ready: plain || challenge !== "trivia" || pool.length > 0,
    /** when the current question went up, so both clients run the same clock */
    askedAt: row ? Date.parse(row.updated_at) : 0,
    seats: { x: row?.x_player ?? null, o: row?.o_player ?? null },
  };
}

/**
 * Dealing the board is not a hook — the lobby starts the game once both players
 * have agreed, and the lobby does not own a board subscription.
 */
export async function startBoard<G extends BoardState, R extends BoardRow>(
  engine: BoardEngine<G, R>, roomId: number, xId: string, oId: string,
) {
  if (!supabase) return null;
  // The database decides who starts. A client-side "am I the host" guard holds
  // against two people but not against one client's effect firing twice, and a
  // second upsert here wipes a board that is already in play.
  const { data: won, error } = await supabase.rpc("claim_room_start", { p_room: roomId });
  if (error) return await attempt("Starting the game", Promise.resolve({ error }));
  if (won !== true) return null;
  return await attempt("Dealing the board", supabase.from(engine.table).upsert({
    room_id: roomId, ...engine.encode(engine.newGame("x")),
    puzzle_id: null, x_player: xId, o_player: oId,
  }));
}
