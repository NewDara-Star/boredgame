import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/app/providers/AuthProvider";
import { useFriends } from "./useFriends";
import { Button } from "@/shared/ui/Button";
import { Card } from "@/shared/ui/Card";
import { Note } from "@/shared/ui/Note";
import { GuestCard } from "@/features/profile/GuestCard";

/**
 * Opening a friend's share link. You need to be someone before you can be a
 * friend, so signed out this offers the same one-tap guest name the room invite
 * does; signed in it just confirms and adds.
 */
export function AddFriendPage() {
  const { code } = useParams();
  const { user, offline } = useAuth();
  const { addFriend, error } = useFriends();
  const nav = useNavigate();
  const [added, setAdded] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (offline) {
    return (
      <Card className="p-6">
        <h1 className="text-xl font-bold">Friends need a database</h1>
        <p className="text-sm text-soft mt-2">
          Add your Supabase keys to <code>.env</code> to play head-to-head with friends.
        </p>
      </Card>
    );
  }

  if (added) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-[12px] font-black uppercase tracking-widest text-soft">Friend added</p>
        <h1 className="font-display text-[30px] leading-none font-semibold">{added} is on your list</h1>
        <p className="text-sm text-soft font-semibold">
          Head to Head-to-head and tap Play beside them any time.
        </p>
        <Button className="w-full" onClick={() => nav("/rooms")}>Go to Head-to-head</Button>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="space-y-4">
        <div>
          <p className="text-[12px] font-black uppercase tracking-widest text-soft">You've been invited</p>
          <h1 className="font-display text-[30px] leading-none font-semibold mt-1">Add a friend</h1>
          <p className="text-sm text-soft font-semibold mt-2">
            Pick a name and they're on your list — you can play each other with one tap, no codes.
          </p>
        </div>
        <GuestCard note="Type a name to add them. No password." />
      </div>
    );
  }

  const doAdd = async () => {
    if (!code || busy) return;
    setBusy(true);
    const name = await addFriend(code);
    setBusy(false);
    if (name) setAdded(name);
  };

  return (
    <div className="space-y-4 text-center">
      <p className="text-[12px] font-black uppercase tracking-widest text-soft">Friend request</p>
      <h1 className="font-display text-[30px] leading-none font-semibold">Add this friend?</h1>
      <p className="text-sm text-soft font-semibold">
        You'll be able to invite each other to a game with one tap.
      </p>
      <Button className="w-full" onClick={() => void doAdd()} disabled={busy}>
        {busy ? "Adding…" : "Add friend"}
      </Button>
      <Note>{error}</Note>
      <button onClick={() => nav("/")}
        className="block mx-auto text-[13px] font-black uppercase tracking-wider text-soft underline underline-offset-4">
        Not now
      </button>
    </div>
  );
}
