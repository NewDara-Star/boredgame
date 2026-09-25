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
        <div key={i.id} className="card bg-petal p-3 flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-bold truncate">
              {i.from_name} wants to play
            </p>
            <p className="text-[12px] font-black text-ink/60">
              Room {i.room_code}
            </p>
          </div>
          <button onClick={() => onDismiss(i)}
            className="text-[12px] font-black text-ink/50 px-2 py-2">
            Dismiss
          </button>
          <button onClick={() => onJoin(i)}
            className="cut tap cut-ink text-ground px-4 min-h-[44px] inline-flex items-center font-display font-semibold">
            Join
          </button>
        </div>
      ))}
    </div>
  );
}

/** Head-to-head panel: invites, your people (one tap to play), and your link. */
export function FriendsPanel() {
  const { user, profile, isGuest, claimedAs } = useAuth();
  const uname = profile?.username ?? user?.email?.split("@")[0] ?? "player";
  const { code, friends, invites, error, setError, addFriend, invite, respond, removeFriend, newCode } = useFriends();
  // Remove and New code each ask once, in place (talk item 16).
  const [removing, setRemoving] = useState<string | null>(null);
  const [renewing, setRenewing] = useState(false);
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

  const play = async (friendId: string, friendName: string) => {
    if (!user || busy) return;
    setBusy(true);
    const waiting = pendingFrom(friendId);
    if (waiting) { await respond(waiting.id, true); nav(`/rooms/${waiting.room_code}`); return; }
    const r = await createRoom(user.id, uname);
    if (!r) { setError("Couldn't open a room. Try again."); setBusy(false); return; }
    // The room is yours either way; if the invite didn't land, the room says so
    // and points at its code instead of leaving you waiting for nobody.
    const invited = await invite(r.id, friendId);
    nav(`/rooms/${r.code}`, invited ? undefined : { state: { inviteFailed: friendName } });
  };

  const join = async (i: Invite) => { await respond(i.id, true); nav(`/rooms/${i.room_code}`); };
  const dismiss = (i: Invite) => void respond(i.id, false);

  return (
    <div className="space-y-4">
      <NotificationsCard />
      <InviteCards invites={invites} onJoin={join} onDismiss={dismiss} />

      {friends.length > 0 && (
        <div className="space-y-2">
          <p className="text-[12px] font-black text-soft">Your people</p>
          {friends.map((f) => removing === f.id ? (
            <div key={f.id} className="card bg-board p-3 space-y-2">
              <p className="text-[14px] font-bold">Remove {f.username}?</p>
              <p className="text-[12px] font-semibold text-soft">
                You come off each other's lists and they can't invite you. To add you again they'd need your link.
              </p>
              <div className="flex gap-2">
                <Button variant="ghost" className="flex-1" onClick={() => setRemoving(null)}>Keep</Button>
                <Button className="flex-1" disabled={busy}
                  onClick={() => void removeFriend(f.id).then((done) => { if (done) setRemoving(null); })}>
                  Remove
                </Button>
              </div>
            </div>
          ) : (
            <div key={f.id} className="card bg-board p-2.5 flex items-center gap-3">
              <Avatar id={f.id} name={f.username} size={34} />
              <span className="min-w-0 flex-1 font-bold truncate">{f.username}</span>
              <button onClick={() => setRemoving(f.id)} aria-label={`Remove ${f.username}`}
                className="text-[12px] font-black text-ink/50 px-2 min-h-[44px]">
                Remove
              </button>
              <button onClick={() => void play(f.id, f.username)} disabled={busy}
                className="cut tap cut-ink text-ground px-4 min-h-[44px] inline-flex items-center font-display font-semibold">
                {pendingFrom(f.id) ? "Join" : "Play"}
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <p className="text-[12px] font-black text-soft">Add a friend</p>
        {link && (
          <button onClick={() => void copy()}
            className="cut tap w-full cut-leaf-hi px-4 py-3 text-left flex items-center justify-between">
            <span className="min-w-0 truncate font-bold text-[13px]">{link.replace(/^https?:\/\//, "")}</span>
            <span className="text-[12px] font-black shrink-0 ml-2">
              {copied ? "Copied" : "Copy link"}
            </span>
          </button>
        )}
        {link && (renewing ? (
          <div className="card bg-board p-3 space-y-2">
            <p className="text-[14px] font-bold">Make a new link?</p>
            <p className="text-[12px] font-semibold text-soft">
              Your old link and code stop working straight away. The friends you have stay.
            </p>
            <div className="flex gap-2">
              <Button variant="ghost" className="flex-1" onClick={() => setRenewing(false)}>Keep this one</Button>
              <Button className="flex-1" onClick={() => void newCode().then((done) => { if (done) setRenewing(false); })}>
                New link
              </Button>
            </div>
          </div>
        ) : (
          <button onClick={() => setRenewing(true)}
            className="text-[12px] font-black text-ink/50 min-h-[44px]">
            Link got out? Make a new one
          </button>
        ))}
        <p className="text-[12px] text-soft font-semibold">Send that link, or paste theirs:</p>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void add(); }}>
          <Input value={paste} onChange={(e) => { setPaste(e.target.value); if (error) setError(null); }}
            placeholder="Their code or link" />
          <Button type="submit" variant="ghost">Add</Button>
        </form>
        <Note>{error}</Note>
      </div>

      {((isGuest && friends.length > 0) || claimedAs) && (
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
