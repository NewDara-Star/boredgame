import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/shared/lib/supabase";
import { attempt } from "@/shared/lib/write";
import type { Room, RoomPlayer, RoomRound } from "@/shared/types/db";
import { loadContent, shuffle } from "@/features/play/content";
import { scopePool, emptyReason, levelCounts } from "@/features/play/scope";
import type { PlayItem } from "@/features/play/types";

/**
 * The whole of the "websocket problem". Both browsers subscribe to three tables;
 * Postgres pushes every change. No socket code is written anywhere in this app.
 */
export function useRoom(code: string | undefined, userId: string | undefined) {
  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<RoomPlayer[]>([]);
  const [round, setRound] = useState<RoomRound | null>(null);
  const [pool, setPool] = useState<PlayItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (roomId: number) => {
    if (!supabase) return;
    const [p, r] = await Promise.all([
      supabase.from("room_players").select("*").eq("room_id", roomId),
      supabase.from("room_rounds").select("*").eq("room_id", roomId).order("round_no", { ascending: false }).limit(1),
    ]);
    let list = (p.data as RoomPlayer[]) ?? [];
    // A room is no longer readable by strangers, so before you have joined,
    // room_players comes back empty and the invite screen loses the "Ada and
    // Tayo are waiting" that makes it worth joining. room_peek trades the code
    // you already hold for names and nothing else.
    if (list.length === 0 && code) {
      const { data: peek } = await supabase.rpc("room_peek", { p_code: code });
      list = ((peek as { user_id: string; username: string; ready: boolean }[]) ?? [])
        .map((x) => ({
          ...x, room_id: roomId, score: 0,
          last_seen: new Date().toISOString(),
        })) as RoomPlayer[];
    }
    setPlayers(list);
    setRound(((r.data as RoomRound[]) ?? [])[0] ?? null);
  }, [code]);

  // Find the room by its code, then subscribe to everything about it.
  useEffect(() => {
    if (!supabase || !code) return;
    let channel: ReturnType<NonNullable<typeof supabase>["channel"]> | null = null;
    let cancelled = false;

    (async () => {
      // Not a table read any more: `rooms` is readable only by the people in it,
      // because SELECT USING (true) meant anyone holding the anon key could list
      // every room and every code. Holding the code is what this trades on.
      const { data, error } = await supabase!.rpc("find_room", { p_code: code }).maybeSingle();
      if (cancelled) return;
      if (error || !data) { setError("No room with that code."); return; }
      const r = data as Room;
      setRoom(r);
      await refresh(r.id);

      channel = supabase!
        .channel(`room:${r.id}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "room_players", filter: `room_id=eq.${r.id}` },
          () => void refresh(r.id))
        .on("postgres_changes", { event: "*", schema: "public", table: "room_rounds", filter: `room_id=eq.${r.id}` },
          () => void refresh(r.id))
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "rooms", filter: `id=eq.${r.id}` },
          (payload) => setRoom(payload.new as Room))
        .subscribe();
    })();

    return () => { cancelled = true; if (channel) void supabase!.removeChannel(channel); };
  }, [code, refresh]);

  // The bank follows the room's game rather than being read once on arrival.
  // Loading it with the room meant that changing the game in the lobby left the
  // old bank in place: the category chips described the game you had just left,
  // and a race dealt out of it. Only visible now that a room can be reopened and
  // set to something else.
  useEffect(() => {
    if (!room) return;
    let cancelled = false;
    void loadContent(room.game).then((all) => { if (!cancelled) setPool(all); });
    return () => { cancelled = true; };
  }, [room?.game]); // eslint-disable-line react-hooks/exhaustive-deps

  // A heartbeat on the row both players already subscribe to: the update itself
  // is what tells the other browser you are still here.
  useEffect(() => {
    if (!supabase || !room || !userId) return;
    const beat = () => void supabase!.rpc("touch_presence", { p_room: room.id });
    beat();
    const id = setInterval(beat, 20_000);
    return () => clearInterval(id);
  }, [room?.id, userId]); // eslint-disable-line react-hooks/exhaustive-deps

  const join = useCallback(async (username: string) => {
    if (!supabase || !room || !userId) return;
    const { data, error: e } = await supabase.rpc("join_room",
      { p_room: room.id, p_username: username });
    if (e) { setError(`Joining didn't go through: ${e.message}`); return; }
    if (data === "full") setError("This room already has two players in it.");
    else if (data === "started") setError("That match has already started — ask them for a new room.");
    else if (data === "missing") setError("No room with that code.");
    else { setError(null); await refresh(room.id); }
  }, [room, userId, refresh]);

  const startNextRound = useCallback(async () => {
    if (!supabase || !room || pool.length === 0) return;
    const used = round?.round_no ?? 0;
    if (used >= room.best_of) {
      setError(await attempt("Finishing the match",
        supabase.from("rooms").update({ status: "finished" }).eq("id", room.id)));
      return;
    }
    const scoped = scopePool(pool, room);
    const pick = shuffle(scoped).find((i) => /^\d+$/.test(i.id));
    if (!pick) {
      // Two very different causes, and telling someone their database is empty
      // when they simply picked Music and Places is not a useful thing to say.
      setError(pool.length === 0
        ? "Multiplayer needs puzzles stored in the database, not bundled ones."
        : emptyReason(room, false));
      return;
    }
    setError(await attempt("Starting the round",
      supabase.from("rooms").update({ status: "playing" }).eq("id", room.id)));
    setError(await attempt("Dealing the round", supabase.from("room_rounds").insert({
      room_id: room.id, puzzle_id: Number(pick.id), round_no: used + 1,
    })));
  }, [room, round, pool]);

  /** First correct answer wins: the null filter means only one update can land. */
  const claimWin = useCallback(async () => {
    if (!supabase || !round || !userId || !room) return;
    const { data } = await supabase
      .from("room_rounds")
      .update({ winner_id: userId, ended_at: new Date().toISOString() })
      .eq("id", round.id).is("winner_id", null).select();
    if (data && data.length > 0) {
      setError(await attempt("Recording the point",
        supabase.rpc("bump_room_score", { p_room: room.id, p_user: userId })));
    }
  }, [round, userId, room, players]);

  const currentPuzzle = round ? pool.find((i) => i.id === String(round.puzzle_id)) ?? null : null;

  /** Derived from the pool already loaded for this room's game, so the counts
      always describe what this room can actually serve. */
  const categories = (() => {
    // Counted at the room's chosen difficulty, not over the whole bank: a chip
    // reading "Maths 198" beside an Easy-only room is a lie about what it deals.
    const tally = new Map<string, number>();
    for (const i of scopePool(pool, { difficulty: room?.difficulty }))
      if (i.category) tally.set(i.category, (tally.get(i.category) ?? 0) + 1);
    return [...tally].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  })();

  /** Counted the other way round, so each pair of numbers describes the pool
      you get by adding that one filter to what is already chosen. */
  const levels = levelCounts(pool, room?.categories);

  const setup = useCallback(
    async (mode: string, game: string, cats: string[], levels: string[]) => {
      if (!supabase || !room) return;
      setError(await attempt("Changing the setup", supabase.rpc("set_room_setup", {
        p_room: room.id, p_mode: mode, p_game: game,
        p_categories: cats, p_difficulty: levels,
      })));
    }, [room]);

  const setReady = useCallback(async (ready: boolean) => {
    if (!supabase || !room || !userId) return;
    setError(await attempt("Marking you ready", supabase.from("room_players")
      .update({ ready }).eq("room_id", room.id).eq("user_id", userId)));
  }, [room, userId]);

  return {
    room, players, round, currentPuzzle, error, categories, levels,
    join, startNextRound, claimWin, setup, setReady,
  };
}

/** Creates an empty room. What is played, and from which categories, is settled
    in the lobby with the other person rather than guessed at before they arrive. */
export async function createRoom(userId: string, username: string): Promise<string | null> {
  if (!supabase) return null;
  const code = Array.from({ length: 6 }, () =>
    "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join("");
  const { data, error } = await supabase
    .from("rooms")
    .insert({ code, host_id: userId, game: "trivia", mode: "squareoff",
              status: "waiting", best_of: 5, categories: null, difficulty: null })
    .select().single();
  if (error || !data) return null;
  // Creating a room is joining it. Making the host click "Join this room" on a
  // room they just made is a step with no decision in it. It goes through
  // join_room like everyone else — the open insert policy is gone, because that
  // is what let a third person walk in.
  await supabase.rpc("join_room", { p_room: data.id, p_username: username });
  return code;
}
