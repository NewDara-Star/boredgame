import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/app/providers/AuthProvider";
import { createRoom } from "@/features/rooms/useRoom";
import { useFriends, type Invite } from "./useFriends";
import { NotificationsCard } from "@/features/push/Notifications";
import { Avatar } from "@/shared/ui/Avatar";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Field";
import { Note } from "@/shared/ui/Note";
import { ClaimCard } from "@/features/profile/GuestCard";

/** The pending "come play" invites, as tappable cards. Presentational. */
function InviteCards({ invites, onJoin, onDismiss }: {
  invites: Invite[];
  onJoin: (i: Invite) => void;
  onDismiss: (i: Invite) => void;
}) {
  if (invites.length === 0) return null;
  return (
    <div className="space-y-2">
      {invites.map((i) => (
        <div key={i.id} className="piece bg-pop p-3 flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-bold truncate">
              {i.from_name} wants to play
            </p>
            <p className="text-[12px] font-black uppercase tracking-wider text-ink/60">
              Room {i.room_code}
            </p>
          </div>
          <button onClick={() => onDismiss(i)}
            className="text-[12px] font-black uppercase tracking-wider text-ink/50 px-2 py-2">
            Dismiss
          </button>
          <button onClick={() => onJoin(i)}
            className="piece press bg-ink text-paper px-4 min-h-[44px] inline-flex items-center font-display font-semibold">
            Join
          </button>
        </div>
      ))}
    </div>
  );
}

/** Home banner: just the invites waiting for you. */
export function Invites() {
  const { invites, respond } = useFriends();
  const nav = useNavigate();
  const join = async (i: Invite) => { await respond(i.id, true); nav(`/rooms/${i.room_code}`); };
  const dismiss = (i: Invite) => void respond(i.id, false);
  if (invites.length === 0) return null;
  return <div className="mb-4"><InviteCards invites={invites} onJoin={join} onDismiss={dismiss} /></div>;
}

/** Head-to-head panel: invites, your people (one tap to play), and your link. */
export function FriendsPanel() {
  const { user, profile, isGuest } = useAuth();
  const uname = profile?.username ?? user?.email?.split("@")[0] ?? "player";
  const { code, friends, invites, error, setError, addFriend, invite, respond } = useFriends();
  const nav = useNavigate();
  const [paste, setPaste] = useState("");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  const link = code ? `${window.location.origin}/add/${code}` : "";

  const copy = async () => {
    if (!link) return;
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500); }
    catch { /* clipboard blocked; the link is on screen to copy by hand */ }
  };

  const add = async () => {
    if (!paste.trim()) return;
    const name = await addFriend(paste);
    if (name) setPaste("");
  };

  // A pending invite FROM this friend means they already opened a room and are
  // waiting -- meet them there instead of opening a second room and crossing.
  const pendingFrom = (friendId: string) => invites.find((i) => i.from_id === friendId);

  const play = async (friendId: string) => {
    if (!user || busy) return;
    setBusy(true);
    const waiting = pendingFrom(friendId);
    if (waiting) { await respond(waiting.id, true); nav(`/rooms/${waiting.room_code}`); return; }
    const r = await createRoom(user.id, uname);
    if (r) { await invite(r.id, friendId); nav(`/rooms/${r.code}`); }
    else setBusy(false);
  };

  const join = async (i: Invite) => { await respond(i.id, true); nav(`/rooms/${i.room_code}`); };
  const dismiss = (i: Invite) => void respond(i.id, false);

  return (
    <div className="space-y-4">
      <NotificationsCard />
      <InviteCards invites={invites} onJoin={join} onDismiss={dismiss} />

      {friends.length > 0 && (
        <div className="space-y-2">
          <p className="text-[12px] font-black uppercase tracking-widest text-soft">Your people</p>
          {friends.map((f) => (
            <div key={f.id} className="piece bg-surface p-2.5 flex items-center gap-3">
              <Avatar id={f.id} name={f.username} size={34} />
              <span className="min-w-0 flex-1 font-bold truncate">{f.username}</span>
              <button onClick={() => void play(f.id)} disabled={busy}
                className="piece press bg-ink text-paper px-4 min-h-[44px] inline-flex items-center font-display font-semibold">
                {pendingFrom(f.id) ? "Join" : "Play"}
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <p className="text-[12px] font-black uppercase tracking-widest text-soft">Add a friend</p>
        {link && (
          <button onClick={() => void copy()}
            className="piece press w-full bg-acid px-4 py-3 text-left flex items-center justify-between">
            <span className="min-w-0 truncate font-bold text-[13px]">{link.replace(/^https?:\/\//, "")}</span>
            <span className="text-[12px] font-black uppercase tracking-wider shrink-0 ml-2">
              {copied ? "Copied" : "Copy link"}
            </span>
          </button>
        )}
        <p className="text-[12px] text-soft font-semibold">Send that link, or paste theirs:</p>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void add(); }}>
          <Input value={paste} onChange={(e) => { setPaste(e.target.value); if (error) setError(null); }}
            placeholder="Their code or link" />
          <Button type="submit" variant="ghost">Add</Button>
        </form>
        <Note>{error}</Note>
      </div>

      {isGuest && friends.length > 0 && (
        <div className="space-y-2">
          <p className="text-[13px] font-bold text-soft">
            You're playing as a guest — claim your account so you don't lose your friends.
          </p>
          <ClaimCard />
        </div>
      )}
    </div>
  );
}
