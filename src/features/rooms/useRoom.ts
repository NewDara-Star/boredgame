import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/shared/lib/supabase";
import type { Room, RoomPlayer, RoomRound } from "@/shared/types/db";
import { loadContent, shuffle } from "@/features/play/content";
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
    setPlayers((p.data as RoomPlayer[]) ?? []);
    setRound(((r.data as RoomRound[]) ?? [])[0] ?? null);
  }, []);

  // Find the room by its code, then subscribe to everything about it.
  useEffect(() => {
    if (!supabase || !code) return;
    let channel: ReturnType<NonNullable<typeof supabase>["channel"]> | null = null;
    let cancelled = false;

    (async () => {
      const { data, error } = await supabase!.from("rooms").select("*").eq("code", code.toUpperCase()).single();
      if (cancelled) return;
      if (error || !data) { setError("No room with that code."); return; }
      const r = data as Room;
      setRoom(r);
      await refresh(r.id);
      setPool(await loadContent(r.game));

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

  const join = useCallback(async (username: string) => {
    if (!supabase || !room || !userId) return;
    await supabase.from("room_players").upsert({ room_id: room.id, user_id: userId, username });
  }, [room, userId]);

  const startNextRound = useCallback(async () => {
    if (!supabase || !room || pool.length === 0) return;
    const used = round?.round_no ?? 0;
    if (used >= room.best_of) {
      await supabase.from("rooms").update({ status: "finished" }).eq("id", room.id);
      return;
    }
    const pick = shuffle(pool).find((i) => /^\d+$/.test(i.id));
    if (!pick) { setError("Multiplayer needs puzzles stored in the database, not bundled ones."); return; }
    await supabase.from("rooms").update({ status: "playing" }).eq("id", room.id);
    await supabase.from("room_rounds").insert({
      room_id: room.id, puzzle_id: Number(pick.id), round_no: used + 1,
    });
  }, [room, round, pool]);

  /** First correct answer wins: the null filter means only one update can land. */
  const claimWin = useCallback(async () => {
    if (!supabase || !round || !userId || !room) return;
    const { data } = await supabase
      .from("room_rounds")
      .update({ winner_id: userId, ended_at: new Date().toISOString() })
      .eq("id", round.id).is("winner_id", null).select();
    if (data && data.length > 0) {
      const me = players.find((p) => p.user_id === userId);
      await supabase.from("room_players")
        .update({ score: (me?.score ?? 0) + 1 })
        .eq("room_id", room.id).eq("user_id", userId);
    }
  }, [round, userId, room, players]);

  const currentPuzzle = round ? pool.find((i) => i.id === String(round.puzzle_id)) ?? null : null;

  return { room, players, round, currentPuzzle, error, join, startNextRound, claimWin };
}

export async function createRoom(
  userId: string, game: "picto" | "trivia", username: string
): Promise<string | null> {
  if (!supabase) return null;
  const code = Array.from({ length: 6 }, () =>
    "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join("");
  const { data, error } = await supabase
    .from("rooms")
    .insert({ code, host_id: userId, game, status: "waiting", best_of: 5 })
    .select().single();
  if (error || !data) return null;
  // Creating a room is joining it. Making the host click "Join this room" on a
  // room they just made is a step with no decision in it.
  await supabase.from("room_players").insert({ room_id: data.id, user_id: userId, username });
  return code;
}
