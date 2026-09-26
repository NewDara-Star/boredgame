import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Room } from "@/shared/types/db";
import { useAuth } from "@/app/providers/AuthProvider";
import { Sunflower } from "@/shared/brand/Sunflower";
import { RAMPS } from "@/shared/brand/tokens";
import { ScreenTitle } from "@/app/layout/ScreenTitle";
import { ROOM_GAMES } from "@/features/play/registry";
import { rankFor } from "@/features/play/rank";
import { FriendsPanel } from "@/features/friends/Friends";
import { useFriends } from "@/features/friends/useFriends";
import { GuestCard } from "@/features/profile/GuestCard";
import { AuthCard } from "@/features/profile/AuthCard";
import { Note } from "@/shared/ui/Note";
import { createRoom } from "./useRoom";
import { roomGame } from "./RoomScreens";
import { spaced } from "./RoomTop";

/** .av in one of the family colours, so a list of people isn't one colour. */
const HUES = ["sky", "gum", "leaf", "grape", "ember"] as const;
function Face({ name, i }: { name: string; i: number }) {
  const r = RAMPS[HUES[i % HUES.length]];
  return (
    <span aria-hidden className="shrink-0 grid place-items-center w-[34px] h-[34px] rounded-full font-display text-[15px] text-ink"
      style={{ background: `radial-gradient(circle at 35% 30%, ${r.hi}, ${r.base} 60%)`, border: "2.5px solid var(--color-ink-day)", boxShadow: "0 3px 0 var(--color-ink-day)" }}>
      {(name.trim()[0] ?? "?").toUpperCase()}
    </span>
  );
}

/** "Skilled · played yesterday": their rank, and when they last played. */
function about(f: { total_answered?: number; last_played?: string | null }): string {
  const rank = rankFor(f.total_answered ?? 0).current.name;
  if (!f.last_played) return rank;
  const days = Math.round((Date.parse(new Date().toISOString().slice(0, 10)) - Date.parse(f.last_played)) / 86_400_000);
  return `${rank} · ${days <= 0 ? "played today" : days === 1 ? "played yesterday" : days < 14 ? `played ${days} days ago` : "not played lately"}`;
}

const Title = ScreenTitle;

function JoinByCode({ label = "Join with a code" }: { label?: string }) {
  const nav = useNavigate();
  const [code, setCode] = useState("");
  return (
    <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); const c = code.replace(/\s/g, "").toUpperCase(); if (c) nav(`/rooms/${c}`); }}>
      <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder={label} aria-label={label}
        maxLength={7} autoCapitalize="characters" autoCorrect="off" spellCheck={false}
        className="min-w-0 flex-1 rounded-[14px] bg-board px-3.5 py-3 text-[16px] font-semibold text-ink shadow-[inset_0_0_0_2px_var(--color-hair)] outline-none placeholder:text-soft" />
      <button type="submit" className="cut tap cut-board px-5 min-h-[48px] font-display text-[17px]">Join</button>
    </form>
  );
}

/** #33: Rooms, signed out. A name is all it takes. */
export function RoomsGuest() {
  const [account, setAccount] = useState(false);
  return (
    <div className="grid gap-3">
      <Title>Play someone</Title>
      <div className="card grid gap-2 rounded-[20px] bg-board p-3.5 text-ink">
        <div className="flex items-center gap-2.5">
          <Sunflower state="look-right" size={70} className="shrink-0" />
          <div className="min-w-0">
            <b className="block font-display font-normal text-[21px] leading-tight">Just need a name</b>
            <p className="text-[14px] font-semibold text-soft">No password. You can make it a proper account later.</p>
          </div>
        </div>
        <GuestCard bare cta="Start playing" />
      </div>
      <div className="card grid gap-2 rounded-[20px] bg-board px-3 py-2.5 text-ink">
        <span className="text-[12px] font-extrabold text-soft">Got a code?</span>
        <JoinByCode label="D97 RFU" />
      </div>
      {account ? <AuthCard /> : (
        <button onClick={() => setAccount(true)} className="min-h-[44px] text-[13px] font-extrabold text-soft underline underline-offset-4">
          I have an account
        </button>
      )}
    </div>
  );
}

/**
 * #34: Rooms, signed in. Your people with a Play button each, the rooms you're
 * still in, then a new room and join by code. Adding a friend is a link at
 * the bottom that opens its own part, not a panel in the way.
 */
export function RoomsHome({ myRooms }: {
  myRooms: Pick<Room, "id" | "code" | "status" | "mode" | "game" | "challenge" | "host_id">[];
}) {
  const { user, profile } = useAuth();
  const nav = useNavigate();
  const { friends, invites, invite, respond, error, setError } = useFriends();
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const uname = profile?.username ?? user?.email?.split("@")[0] ?? "player";

  const pendingFrom = (id: string) => invites.find((i) => i.from_id === id);
  const play = async (id: string, name: string) => {
    if (!user || busy) return;
    setBusy(true);
    const waiting = pendingFrom(id);
    if (waiting) { await respond(waiting.id, true); nav(`/rooms/${waiting.room_code}`); return; }
    const r = await createRoom(user.id, uname);
    if (!r) { setError("Couldn't open a room. Try again."); setBusy(false); return; }
    const ok = await invite(r.id, id);
    nav(`/rooms/${r.code}`, ok ? undefined : { state: { inviteFailed: name } });
  };
  const newRoom = async () => {
    if (!user || busy) return;
    setBusy(true);
    const r = await createRoom(user.id, uname);
    setBusy(false);
    if (r) nav(`/rooms/${r.code}`); else setError("Couldn't open a room. Try again.");
  };

  return (
    <div className="grid gap-3">
      <Title>Play someone</Title>

      {/* someone asked you to play: first, and one tap */}
      {invites.map((i) => (
        <div key={i.id} className="card flex items-center gap-2.5 rounded-2xl bg-petal px-3 py-2 text-ink">
          <Sunflower state="bloom" stem={false} size={34} />
          <div className="min-w-0 flex-1">
            <b className="block text-[15px] leading-tight truncate">{i.from_name} wants to play</b>
            <small className="block text-[12px] font-semibold">Room {spaced(i.room_code)}</small>
          </div>
          <button onClick={() => void respond(i.id, false)} className="min-h-[44px] px-1.5 text-[12px] font-extrabold">Not now</button>
          <button onClick={() => { void respond(i.id, true); nav(`/rooms/${i.room_code}`); }}
            className="cut tap cut-sky px-3.5 min-h-[44px] font-display text-[16px]">Join</button>
        </div>
      ))}

      {friends.length > 0 && (
        <div className="grid gap-2">
          {friends.map((f, n) => (
            <div key={f.id} className="card flex items-center gap-2.5 rounded-2xl bg-board px-3 py-[9px] text-ink">
              <Face name={f.username} i={n} />
              <div className="min-w-0 flex-1">
                <b className="block text-[15px] leading-tight truncate">{f.username}</b>
                <small className="block text-[12px] font-semibold text-soft">{about(f)}</small>
              </div>
              <button onClick={() => void play(f.id, f.username)} disabled={busy}
                className="cut tap cut-sky px-3.5 min-h-[44px] font-display text-[16px]">
                {pendingFrom(f.id) ? "Join" : "Play"}
              </button>
            </div>
          ))}
        </div>
      )}

      {myRooms.length > 0 && (
        <div className="card grid gap-2 rounded-[20px] bg-board px-3 py-2.5 text-ink">
          <span className="text-[12px] font-extrabold text-soft">Still going</span>
          {myRooms.map((r) => {
            const g = roomGame(r as Room);
            const Art = ROOM_GAMES.find((x) => x.slug === g.slug)?.Art;
            return (
              <div key={r.id} className="flex items-center gap-2.5">
                {Art && <span className="shrink-0 w-11 h-11 grid place-items-center"><Art size={44} /></span>}
                <div className="min-w-0 flex-1">
                  <b className="block text-[15px] leading-tight truncate">{g.name}</b>
                  <small className="block text-[12px] font-semibold text-soft">
                    {r.status === "playing" ? "Playing" : "Waiting"} · {spaced(r.code)}
                  </small>
                </div>
                <button onClick={() => nav(`/rooms/${r.code}`)} className="cut tap cut-board px-3.5 min-h-[44px] font-display text-[16px]">Back in</button>
              </div>
            );
          })}
        </div>
      )}

      <button onClick={() => void newRoom()} disabled={busy} className="cut tap cut-petal min-h-[52px] font-display text-[19px]">New room</button>
      <JoinByCode />
      <Note>{error}</Note>

      {adding ? (
        <div className="grid gap-2">
          <FriendsPanel manage />
          <button onClick={() => setAdding(false)} className="min-h-[44px] text-[13px] font-extrabold text-soft underline underline-offset-4">Done</button>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} className="min-h-[44px] text-[13px] font-extrabold text-soft underline underline-offset-4">
          Add a friend
        </button>
      )}
    </div>
  );
}
