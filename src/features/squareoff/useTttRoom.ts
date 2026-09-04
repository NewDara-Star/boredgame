import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/shared/lib/supabase";
import type { RoomPlayer } from "@/shared/types/db";
import { loadContent, shuffle } from "@/features/play/content";
import type { PlayItem } from "@/features/play/types";
import { newGame, pick, answer, advance, type Game, type Mark } from "./rules";
import { decode, encode, type TttRow } from "./wire";

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
  roomId: number | null, userId: string | undefined, players: RoomPlayer[] = [],
  categories: string[] | null = null,
) {
  const [row, setRow] = useState<TttRow | null>(null);
  const [pool, setPool] = useState<PlayItem[]>([]);
  const seen = useRef<Set<number>>(new Set());

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
    const fresh = scoped.find((i) => !seen.current.has(Number(i.id))) ?? scoped[0] ?? pool[0];
    if (!fresh) return null;
    seen.current.add(Number(fresh.id));
    return Number(fresh.id);
  }, [pool, categories]);

  /** Write a transition. `puzzle` is set whenever the new state needs a question. */
  const write = useCallback(async (next: Game, withPuzzle: boolean) => {
    if (!supabase || !roomId) return;
    const patch: Record<string, unknown> = { ...encode(next), updated_at: new Date().toISOString() };
    if (withPuzzle) patch.puzzle_id = nextPuzzleId();
    await supabase.from("ttt_games").update(patch).eq("room_id", roomId);
  }, [roomId, nextPuzzleId]);

  /** Host deals the board. Two rows can never exist — room_id is the primary key. */
  const start = useCallback(async (hostId: string, guestId: string) => {
    if (!supabase || !roomId || pool.length === 0) return;
    const g = newGame("x");
    await supabase.from("ttt_games").upsert({
      room_id: roomId, ...encode(g),
      puzzle_id: null, x_player: hostId, o_player: guestId,
    });
  }, [roomId, pool.length]);

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
      const me = players.find((p) => p.user_id === seat);
      if (!supabase || !seat || !roomId) return;
      await supabase.from("room_players")
        .update({ score: (me?.score ?? 0) + 1 })
        .eq("room_id", roomId).eq("user_id", seat);
    })();
  }, [game, myMark, write, row, players, roomId]);

  /** Ends the session rather than the game. Rematch keeps the tally; this stops it. */
  const quit = useCallback(async () => {
    if (!supabase || !roomId) return;
    await supabase.from("rooms").update({ status: "finished" }).eq("id", roomId);
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
    // Loser goes first next time, which is the only fair way to alternate it.
    const first: Mark = row.winner === "x" ? "o" : "x";
    await supabase.from("ttt_games")
      .update({ ...encode(newGame(first)), puzzle_id: null }).eq("room_id", roomId);
  }, [roomId, row]);

  return {
    game, myMark, item, start, choose, submit, rematch, quit,
    ready: pool.length > 0,
    /** when the current question went up, so both clients run the same clock */
    askedAt: row ? Date.parse(row.updated_at) : 0,
    seats: { x: row?.x_player ?? null, o: row?.o_player ?? null },
  };
}
