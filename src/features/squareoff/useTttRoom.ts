import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/shared/lib/supabase";
import { loadContent, shuffle } from "@/features/play/content";
import type { PlayItem } from "@/features/play/types";
import { newGame, pick, answer, advance, type Game, type Mark } from "./rules";
import { decode, encode, type TttRow } from "./wire";
import { deal } from "@/features/play/dealer";
import { attempt } from "@/shared/lib/write";

/**
 * Two browsers, one board. Both clients run the identical reducer from rules.ts
 * and Postgres carries the result — the same trick the race mode uses, so there
 * is still no socket code anywhere in this app.
 *
 * Who writes: whoever owes the action. The picker writes the pick, the answerer
 * writes the answer, and the answerer also writes the move on from the reveal.
 * Any other arrangement has both clients racing to write the same transition.
 */
export function useTttRoom(
  roomId: number | null, userId: string | undefined,
  categories: string[] | null = null,
) {
  const [row, setRow] = useState<TttRow | null>(null);
  const [pool, setPool] = useState<PlayItem[]>([]);
  const seen = useRef<Set<string>>(new Set());
  const lastServed = useRef<string | null>(null);
  const [poolError, setPoolError] = useState<string | null>(null);
  const [writeError, setWriteError] = useState<string | null>(null);

  useEffect(() => {
    void loadContent("trivia").then((all) =>
      setPool(shuffle(all.filter((i) => i.choices && i.choices.length >= 2 && /^\d+$/.test(i.id)))));
  }, []);

  useEffect(() => {
    if (!supabase || !roomId) return;
    let channel: ReturnType<NonNullable<typeof supabase>["channel"]> | null = null;
    let cancelled = false;
    (async () => {
      const { data } = await supabase!.from("ttt_games").select("*").eq("room_id", roomId).maybeSingle();
      if (cancelled) return;
      setRow((data as TttRow | null) ?? null);
      channel = supabase!
        .channel(`ttt:${roomId}`)
        .on("postgres_changes",
          { event: "*", schema: "public", table: "ttt_games", filter: `room_id=eq.${roomId}` },
          (p) => setRow(p.new as TttRow))
        .subscribe();
    })();
    return () => { cancelled = true; if (channel) void supabase!.removeChannel(channel); };
  }, [roomId]);

  const game: Game | null = row ? decode(row) : null;
  const myMark: Mark | null =
    !row || !userId ? null : row.x_player === userId ? "x" : row.o_player === userId ? "o" : null;
  const item = row?.puzzle_id != null
    ? pool.find((i) => i.id === String(row.puzzle_id)) ?? null
    : null;

  const nextPuzzleId = useCallback(() => {
    const scoped = categories?.length
      ? pool.filter((i) => categories.includes(i.category))
      : pool;
    // An empty scope is a misconfigured room, not a reason to quietly serve from
    // the whole bank as if the filter had never been set.
    if (scoped.length === 0) {
      setPoolError(categories?.length
        ? `Nothing live in ${categories.join(" or ")} for this game. End the match and set it up again.`
        : "No questions are live for this game yet.");
      return null;
    }
    setPoolError(null);
    const { item } = deal(scoped, (i) => i.id, seen.current, { avoid: lastServed.current });
    if (!item) return null;
    lastServed.current = item.id;
    return Number(item.id);
  }, [pool, categories]);

  /** Write a transition. `puzzle` is set whenever the new state needs a question. */
  const write = useCallback(async (next: Game, withPuzzle: boolean) => {
    if (!supabase || !roomId) return;
    const patch: Record<string, unknown> = { ...encode(next), updated_at: new Date().toISOString() };
    if (withPuzzle) patch.puzzle_id = nextPuzzleId();
    setWriteError(await attempt("That move",
      supabase.from("ttt_games").update(patch).eq("room_id", roomId)));
  }, [roomId, nextPuzzleId]);

  const choose = useCallback((square: number) => {
    if (!game || myMark !== game.turn || game.phase !== "picking") return;
    void write(pick(game, square), true);
  }, [game, myMark, write]);

  const submit = useCallback((correct: boolean) => {
    if (!game || game.phase !== "asking" || game.answerer !== myMark) return;
    const next = answer(game, correct);
    void (async () => {
      await write(next, false);
      // The client that wrote the winning move also books the win, so the tally
      // is incremented exactly once no matter how many browsers are watching.
      if (next.phase !== "over" || !next.winner || next.winner === "draw" || !row) return;
      const seat = next.winner === "x" ? row.x_player : row.o_player;
      if (!supabase || !seat || !roomId) return;
      // Incremented in the database, not read-modify-written from this client's
      // copy of the players list — across a rematch that copy can lag behind
      // realtime, and the next win then writes (stale + 1) over the real score.
      setWriteError(await attempt("Recording the win",
        supabase.rpc("bump_room_score", { p_room: roomId, p_user: seat })));
    })();
  }, [game, myMark, write, row, roomId]);

  /** Writes the miss for a question nobody answered — including when the person
      who owed it has closed the tab. Callers must check timeoutWriter() first. */
  const forceTimeout = useCallback(() => {
    if (!game || game.phase !== "asking") return;
    void write(answer(game, false), false);
  }, [game, write]);

  /** Ends the session rather than the game. Rematch keeps the tally; this stops it. */
  const quit = useCallback(async () => {
    if (!supabase || !roomId) return;
    setWriteError(await attempt("Ending the match",
      supabase.from("rooms").update({ status: "finished" }).eq("id", roomId)));
  }, [roomId]);

  // The player who just answered owns the move on, so exactly one client writes it.
  useEffect(() => {
    if (!game || game.phase !== "revealed" || !game.last || game.last.by !== myMark) return;
    const next = advance(game);
    const t = setTimeout(() => void write(next, next.phase === "asking"), 2300);
    return () => clearTimeout(t);
  }, [game, myMark, write]);

  const rematch = useCallback(async () => {
    if (!supabase || !roomId || !row) return;
    // Loser starts the next one. After a draw, alternate off whoever started
    // last rather than defaulting to x every time.
    const first: Mark = row.winner === "x" ? "o"
      : row.winner === "o" ? "x"
      : row.turn === "x" ? "o" : "x";
    setWriteError(await attempt("Starting the rematch",
      supabase.from("ttt_games")
        .update({ ...encode(newGame(first)), puzzle_id: null }).eq("room_id", roomId)));
  }, [roomId, row]);

  return {
    game, myMark, item, choose, submit, rematch, quit, forceTimeout,
    error: poolError ?? writeError,
    ready: pool.length > 0,
    /** when the current question went up, so both clients run the same clock */
    askedAt: row ? Date.parse(row.updated_at) : 0,
    seats: { x: row?.x_player ?? null, o: row?.o_player ?? null },
  };
}

/**
 * Dealing the board is not a hook — the lobby starts the game once both players
 * have agreed, and the lobby does not own a ttt subscription.
 */
export async function startSquareOff(roomId: number, xId: string, oId: string) {
  if (!supabase) return null;
  // The database decides who starts. A client-side "am I the host" guard holds
  // against two people but not against one client's effect firing twice, and a
  // second upsert here wipes a board that is already in play.
  const { data: won, error } = await supabase.rpc("claim_room_start", { p_room: roomId });
  if (error) return await attempt("Starting the game", Promise.resolve({ error }));
  if (won !== true) return null;
  return await attempt("Dealing the board", supabase.from("ttt_games").upsert({
    room_id: roomId, ...encode(newGame("x")),
    puzzle_id: null, x_player: xId, o_player: oId,
  }));
}
