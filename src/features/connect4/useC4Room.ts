import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/shared/lib/supabase";
import { loadContent, shuffle } from "@/features/play/content";
import type { PlayItem } from "@/features/play/types";
import { newGame, pick, drop, answer, advance, type Game, type Mark } from "./rules";
import { decode, encode, type C4Row } from "./wire";
import { deal } from "@/features/play/dealer";
import { attempt } from "@/shared/lib/write";

/**
 * Two browsers, one Connect 4 board. Same arrangement as Square Off: both
 * clients run the identical reducer and Postgres carries the result, so there
 * is still no socket code anywhere in this app.
 *
 * Who writes: whoever owes the action. The player whose turn it is writes the
 * drop, the same player writes their own answer, and the player who answered
 * writes the move on from the reveal. Any other arrangement has both clients
 * racing to write the same row — see CLAUDE.md.
 */
export function useC4Room(
  roomId: number | null, userId: string | undefined,
  categories: string[] | null = null,
  /** Plain Connect 4: tapping a column drops the disc, no question attached. */
  plain = false,
) {
  const [row, setRow] = useState<C4Row | null>(null);
  // Mirrors `row` so `write` can revert a failed move without taking `row` as a
  // dependency — `write` has to keep a stable identity or the reveal timer,
  // which depends on it, restarts every time the row changes.
  const rowRef = useRef<C4Row | null>(null);
  const remember = useCallback((next: C4Row | null) => { rowRef.current = next; setRow(next); }, []);
  const [pool, setPool] = useState<PlayItem[]>([]);
  const seen = useRef<Set<string>>(new Set());
  const lastServed = useRef<string | null>(null);
  const [poolError, setPoolError] = useState<string | null>(null);
  const [writeError, setWriteError] = useState<string | null>(null);

  useEffect(() => {
    if (plain) return;                        // nothing to ask, nothing to fetch
    void loadContent("trivia").then((all) =>
      setPool(shuffle(all.filter((i) => i.choices && i.choices.length >= 2 && /^\d+$/.test(i.id)))));
  }, [plain]);

  useEffect(() => {
    if (!supabase || !roomId) return;
    let channel: ReturnType<NonNullable<typeof supabase>["channel"]> | null = null;
    let cancelled = false;
    (async () => {
      const { data } = await supabase!.from("c4_games").select("*").eq("room_id", roomId).maybeSingle();
      if (cancelled) return;
      remember((data as C4Row | null) ?? null);
      channel = supabase!
        .channel(`c4:${roomId}`)
        .on("postgres_changes",
          { event: "*", schema: "public", table: "c4_games", filter: `room_id=eq.${roomId}` },
          (p) => remember(p.new as C4Row))
        .subscribe();
    })();
    return () => { cancelled = true; if (channel) void supabase!.removeChannel(channel); };
  }, [roomId, remember]);

  const game: Game | null = row ? decode(row) : null;
  const myMark: Mark | null =
    !row || !userId ? null : row.x_player === userId ? "x" : row.o_player === userId ? "o" : null;
  const item = row?.puzzle_id != null
    ? pool.find((i) => i.id === String(row.puzzle_id)) ?? null
    : null;

  const nextPuzzleId = useCallback(() => {
    const scoped = categories?.length ? pool.filter((i) => categories.includes(i.category)) : pool;
    // An empty scope is a misconfigured room, not a reason to quietly serve from
    // the whole bank as if the filter had never been set.
    if (scoped.length === 0) {
      setPoolError(categories?.length
        ? `Nothing live in ${categories.join(" or ")} for this game. End the match and set it up again.`
        : "No questions are live for this game yet.");
      return null;
    }
    setPoolError(null);
    const { item: q } = deal(scoped, (i) => i.id, seen.current, { avoid: lastServed.current });
    if (!q) return null;
    lastServed.current = q.id;
    return Number(q.id);
  }, [pool, categories]);

  /** Write a transition. `withPuzzle` is set whenever the new state needs a question. */
  const write = useCallback(async (next: Game, withPuzzle: boolean) => {
    if (!supabase || !roomId) return;
    const patch: Record<string, unknown> = { ...encode(next), updated_at: new Date().toISOString() };
    if (withPuzzle) patch.puzzle_id = nextPuzzleId();

    // Apply it here first. Waiting for the write AND the realtime echo before
    // showing your own move cost a round trip plus a push before anything moved,
    // and moved nothing at all if realtime hiccupped. Realtime is the
    // confirmation now, not the trigger.
    const before = rowRef.current;
    if (before) remember({ ...before, ...patch } as C4Row);

    const msg = await attempt("That move",
      supabase.from("c4_games").update(patch).eq("room_id", roomId));
    setWriteError(msg);
    // A refused move must not leave a board on screen that no one else can see.
    if (msg && before) remember(before);
  }, [roomId, nextPuzzleId, remember]);

  /** Exactly one client books the win, so the tally moves once per game. */
  const bookWin = useCallback(async (next: Game) => {
    if (next.phase !== "over" || !next.winner || next.winner === "draw") return;
    const r = rowRef.current;
    if (!supabase || !r || !roomId) return;
    const seat = next.winner === "x" ? r.x_player : r.o_player;
    if (!seat) return;
    setWriteError(await attempt("Recording the win",
      supabase.rpc("bump_room_score", { p_room: roomId, p_user: seat })));
  }, [roomId]);

  const choose = useCallback((col: number) => {
    if (!game || myMark !== game.turn || game.phase !== "picking") return;
    if (plain) {
      const next = drop(game, col);
      if (next === game) return;                       // full column, nothing happened
      void (async () => { await write(next, false); await bookWin(next); })();
      return;
    }
    void write(pick(game, col), true);
  }, [game, myMark, write, plain, bookWin]);

  const submit = useCallback((correct: boolean) => {
    if (!game || game.phase !== "asking" || game.turn !== myMark) return;
    const next = answer(game, correct);
    void (async () => { await write(next, false); await bookWin(next); })();
  }, [game, myMark, write, bookWin]);

  /** Move on now rather than sitting out the pause. The timer stays as the
      fallback, but a pause you can skip is the difference between a game that
      feels quick and one that does not. */
  const advanceNow = useCallback(() => {
    if (!game || game.phase !== "revealed" || !game.last || game.last.by !== myMark) return;
    void write(advance(game), false);
  }, [game, myMark, write]);

  /** Writes the miss for a question nobody answered, including when the person
      who owed it has closed the tab. Callers must check stallWriter() first. */
  const forceTimeout = useCallback(() => {
    if (!game || game.phase !== "asking") return;
    void write(answer(game, false), false);
  }, [game, write]);

  /** Moves on from a reveal its owner never wrote — their pause timer lives in
      their tab, and a locked phone suspends it. Unguarded on purpose: the
      caller is whichever client stallWriter() named, not always the answerer. */
  const forceAdvance = useCallback(() => {
    if (!game || game.phase !== "revealed" || !game.last) return;
    void write(advance(game), false);
  }, [game, write]);

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
    // A right answer has nothing to read; a miss has the answer and sometimes an
    // explanation. One fixed pause served neither.
    const pause = game.last.correct ? 1300 : item?.explanation ? 2900 : 2200;
    const t = setTimeout(() => void write(advance(game), false), pause);
    return () => clearTimeout(t);
  }, [plain, game, myMark, write, item?.explanation]);

  const rematch = useCallback(async () => {
    if (!supabase || !roomId || !row) return;
    // Loser starts the next one. After a draw, alternate off whoever started
    // last rather than defaulting to x every time.
    const first: Mark = row.winner === "x" ? "o"
      : row.winner === "o" ? "x"
      : row.turn === "x" ? "o" : "x";
    setWriteError(await attempt("Starting the rematch",
      supabase.from("c4_games")
        .update({ ...encode(newGame(first)), puzzle_id: null }).eq("room_id", roomId)));
  }, [roomId, row]);

  return {
    game, myMark, item, choose, submit, rematch, quit, changeGame, forceTimeout, forceAdvance, advanceNow,
    error: poolError ?? writeError,
    ready: plain || pool.length > 0,
    /** when the current question went up, so both clients run the same clock */
    askedAt: row ? Date.parse(row.updated_at) : 0,
    seats: { x: row?.x_player ?? null, o: row?.o_player ?? null },
  };
}

/**
 * Dealing the board is not a hook — the lobby starts the game once both players
 * have agreed, and the lobby does not own a c4 subscription.
 */
export async function startConnect4(roomId: number, xId: string, oId: string) {
  if (!supabase) return null;
  // The database decides who starts. A client-side "am I the host" guard holds
  // against two people but not against one client's effect firing twice, and a
  // second upsert here wipes a board that is already in play.
  const { data: won, error } = await supabase.rpc("claim_room_start", { p_room: roomId });
  if (error) return await attempt("Starting the game", Promise.resolve({ error }));
  if (won !== true) return null;
  return await attempt("Dealing the board", supabase.from("c4_games").upsert({
    room_id: roomId, ...encode(newGame("x")),
    puzzle_id: null, x_player: xId, o_player: oId,
  }));
}
