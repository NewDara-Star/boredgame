import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/shared/lib/supabase";
import { useAuth } from "@/app/providers/AuthProvider";

export interface Friend { id: string; username: string; avatar: string | null; }
export interface Invite {
  id: number; room_id: number; room_code: string;
  from_id: string; from_name: string; game: string; mode: string;
}

/**
 * The friends layer: your shareable code, the people you've added, and the
 * "come play" invites waiting for you. All of it is plain reads -- rooms and
 * profiles are already public/self readable, a friendship is two rows so "my
 * friends" needs no join gymnastics -- plus four small RPCs for the writes.
 */
export function useFriends() {
  const { user } = useAuth();
  const [code, setCode] = useState<string | null>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadFriends = useCallback(async () => {
    if (!supabase || !user) { setFriends([]); return; }
    const { data } = await supabase.from("friendships")
      .select("friend:profiles!friend_id(id, username, avatar)")
      .eq("user_id", user.id);
    // PostgREST types a to-one embed as an array; it is really 0-or-1 rows.
    setFriends(((data ?? []) as unknown as { friend: Friend | null }[])
      .map((r) => r.friend).filter((f): f is Friend => !!f));
  }, [user?.id]);

  const loadInvites = useCallback(async () => {
    if (!supabase || !user) { setInvites([]); return; }
    const { data } = await supabase.from("game_invites")
      .select("id, room_id, room_code, from_user, from:profiles!from_user(username), room:rooms!room_id(game, mode, status)")
      .eq("to_user", user.id).eq("status", "pending")
      .order("created_at", { ascending: false });
    setInvites(((data ?? []) as Record<string, unknown>[])
      .filter((r) => { const room = r.room as { status?: string } | null; return room?.status === "waiting" || room?.status === "playing"; })
      .map((r) => ({
        id: r.id as number,
        room_id: r.room_id as number,
        room_code: r.room_code as string,
        from_id: r.from_user as string,
        from_name: (r.from as { username?: string } | null)?.username ?? "someone",
        game: (r.room as { game?: string } | null)?.game ?? "",
        mode: (r.room as { mode?: string } | null)?.mode ?? "",
      })));
  }, [user?.id]);

  // Your code, generated on the server the first time it is asked for.
  useEffect(() => {
    if (!supabase || !user) { setCode(null); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase!.rpc("my_friend_code");
      if (!cancelled) setCode((data as string) ?? null);
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  useEffect(() => { void loadFriends(); void loadInvites(); }, [loadFriends, loadInvites]);

  // Live: a new friend or a new invite lights up without a refresh.
  useEffect(() => {
    if (!supabase || !user) return;
    const ch = supabase.channel(`friends:${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "friendships", filter: `user_id=eq.${user.id}` }, () => void loadFriends())
      .on("postgres_changes", { event: "*", schema: "public", table: "game_invites", filter: `to_user=eq.${user.id}` }, () => void loadInvites())
      .subscribe();
    return () => { void supabase!.removeChannel(ch); };
  }, [user?.id, loadFriends, loadInvites]);

  /** Accepts a bare code or a full /add/<code> link. */
  const addFriend = useCallback(async (raw: string): Promise<string | null> => {
    if (!supabase) return null;
    const codeStr = raw.trim().replace(/^.*\/add\//, "").toUpperCase().slice(0, 12);
    if (!codeStr) { setError("Paste a friend code or link."); return null; }
    const { data, error: e } = await supabase.rpc("add_friend", { p_code: codeStr });
    if (e) { setError("Couldn't add that friend — try again."); return null; }
    const res = data as { ok: boolean; name?: string; reason?: string };
    if (!res.ok) {
      setError(res.reason === "no such code" ? "No friend with that code."
        : res.reason === "that is your own code" ? "That's your own code."
        : "Couldn't add that friend.");
      return null;
    }
    setError(null); void loadFriends();
    return res.name ?? "your friend";
  }, [loadFriends]);

  const invite = useCallback(async (roomId: number, friendId: string) => {
    if (!supabase) return;
    await supabase.rpc("invite_friend", { p_room: roomId, p_friend: friendId });
  }, []);

  const respond = useCallback(async (inviteId: number, accept: boolean) => {
    if (!supabase) return;
    await supabase.rpc("respond_invite", { p_invite: inviteId, p_accept: accept });
    void loadInvites();
  }, [loadInvites]);

  return { code, friends, invites, error, setError, addFriend, invite, respond };
}
