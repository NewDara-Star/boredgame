import { useEffect, useState, type ReactNode } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/app/providers/AuthProvider";
import { useFocusMode } from "@/app/layout/focus";
import { createRoom } from "@/features/rooms/useRoom";
import { AuthCard } from "@/features/profile/AuthCard";
import { Avatar } from "@/shared/ui/Avatar";
import { Input } from "@/shared/ui/Field";
import { Sunflower } from "@/shared/brand/Sunflower";
import { useFriends, whoseCode, friendName, type CodeOwner } from "./useFriends";

/**
 * Opening a friend's link (#44, #45), from the drawings' code: one card in
 * the middle of the phone. Who's asking, big, with one button. Signed out, the
 * name field sits on the same card and the one button makes you a guest and
 * adds them (Daramola 26 Sep: the link says whose it is before you sign up).
 * Added, the flower blooms and the next step is a game.
 */

/** .card.center, 22px in, between two spacers (#44, #45). */
function Centre({ children, nav = false }: { children: ReactNode; nav?: boolean }) {
  // Centred on the phone: the whole of it for the request (no tab bar), the
  // space above the tab bar once you're friends.
  return (
    <div className={`${nav ? "min-h-[calc(100dvh-var(--chrome))]" : "min-h-[calc(100dvh-20px-env(safe-area-inset-top)-env(safe-area-inset-bottom))]"} flex flex-col gap-[11px]`}>
      <div className="flex-1" />
      <div className="card shadow-lift-sm rounded-[20px] p-[22px] grid gap-2 justify-items-center text-center text-ink">
        {children}
      </div>
      <div className="flex-1" />
    </div>
  );
}

const H3 = ({ children }: { children: ReactNode }) => <h1 className="font-display text-[22px] leading-[1.1]">{children}</h1>;
const Sub = ({ children }: { children: ReactNode }) => <p className="text-[14px] font-semibold text-soft">{children}</p>;
const GOLD = "cut tap cut-petal w-full min-h-[52px] grid place-items-center font-display text-[19px]";
const WHITE = "cut tap cut-board w-full min-h-[52px] grid place-items-center font-display text-[19px]";
const LINK = "text-[13px] font-extrabold text-soft underline underline-offset-4 min-h-[44px] grid place-items-center";

/** #45: friends now. The flower blooms; Play Tobi now opens a room and asks them. */
function FriendsNow({ name, id }: { name: string; id: string | null }) {
  const { user, profile } = useAuth();
  const { invite } = useFriends();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const play = async () => {
    if (!user || !id) { nav("/rooms"); return; }
    setBusy(true); setFailed(false);
    const r = await createRoom(user.id, profile?.username ?? "player");
    if (!r) { setBusy(false); setFailed(true); return; }
    const ok = await invite(r.id, id);
    nav(`/rooms/${r.code}`, ok ? undefined : { state: { inviteFailed: name } });
  };
  return (
    <Centre nav>
      <Sunflower state="bloom" size={110} />
      <H3>You and {name} are friends</H3>
      <Sub>They'll see you in their people too.</Sub>
      <div className="grid gap-[9px] w-full">
        <button onClick={() => void play()} disabled={busy} className={GOLD}>{busy ? "Opening a room…" : `Play ${name} now`}</button>
        <Link to="/rooms" className={WHITE}>Later</Link>
      </div>
      {failed && <p className="text-[13px] font-bold text-ember-lo" role="alert">Couldn't open a room. Try again.</p>}
    </Centre>
  );
}

export function AddFriendPage() {
  const { code } = useParams();
  const { user, offline, signInAsGuest } = useAuth();
  const { addFriend, lastAdded, error, setError } = useFriends();
  const nav = useNavigate();
  const [added, setAdded] = useState<{ name: string; id: string | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [nameErr, setNameErr] = useState<string | null>(null);
  const [account, setAccount] = useState(false);
  // The request has the whole phone (#44 has no tab bar); friends now has it back (#45).
  useFocusMode(!added);

  // Whose link this is. Signed in: the name, and whether it's you or a friend
  // already (friend_by_code). Signed out: the name only (friend_name).
  const [owner, setOwner] = useState<CodeOwner | null | "unknown" | "asking">("asking");
  // The name, kept while the lookup runs again after a guest signs up mid-add.
  const [known, setKnown] = useState<string | null>(null);
  useEffect(() => {
    if (!code) return;
    let gone = false;
    setOwner("asking");
    const ask = user ? whoseCode(code)
      : friendName(code).then((n) => (n === null || n === "unknown" ? n : { name: n, self: false, already: false }));
    void ask.then((o) => { if (gone) return; setOwner(o); if (o && typeof o === "object") setKnown(o.name); });
    return () => { gone = true; };
  }, [user?.id, code]);

  if (offline) {
    return (
      <Centre>
        <H3>Friends need the internet</H3>
        <Sub>Solo games still work.</Sub>
        <Link to="/play" className={GOLD}>Play solo</Link>
      </Centre>
    );
  }

  if (added) return <FriendsNow name={added.name} id={added.id} />;

  const add = async () => {
    if (!code) return;
    const name = await addFriend(code);
    if (name) setAdded({ name, id: lastAdded.current });
  };

  // Signed out: one tap makes your guest name and adds them.
  const join = async () => {
    if (!code || busy) return;
    setNameErr(null); setError(null); setBusy(true);
    const { error: e } = await signInAsGuest(guestName);
    if (e) { setBusy(false); setNameErr(e); return; }
    await add();
    setBusy(false);
  };

  if (owner === "asking" && !busy) {
    return <Centre><Sunflower state="awake" stem={false} size={74} /><Sub>Checking the link…</Sub></Centre>;
  }

  // No one has this code: they made a new one, or it was mistyped.
  if (owner === null) {
    return (
      <Centre>
        <Sunflower state="bored" size={100} />
        <H3>That link doesn't work any more</H3>
        <Sub>Ask your friend to send their new one.</Sub>
        <Link to="/" className={GOLD}>Go home</Link>
      </Centre>
    );
  }

  if (owner !== "unknown" && owner !== "asking" && owner.self) {
    return (
      <Centre>
        <Sunflower state="look-right" size={100} />
        <H3>That's your own link</H3>
        <Sub>Send it to a friend, and they'll land here.</Sub>
        <Link to="/rooms" className={GOLD}>Go to Rooms</Link>
      </Centre>
    );
  }

  if (owner !== "unknown" && owner !== "asking" && owner.already && !busy) {
    return (
      <Centre>
        <Avatar name={owner.name} size={52} tone="sky" />
        <H3>{owner.name} is already on your list</H3>
        <Sub>Tap Play beside them in Rooms.</Sub>
        <Link to="/rooms" className={GOLD}>Go to Rooms</Link>
      </Centre>
    );
  }

  // "unknown": the lookup failed (a bad signal). Adding still works, so offer
  // it without a name rather than blocking.
  const name = owner === "unknown" || owner === "asking" ? known : owner.name;
  if (!user && account) {
    return (
      <div className="grid gap-[11px] pt-2">
        <AuthCard start="signin" note={name ? `Sign in, then add ${name}.` : "Sign in, then add them."} />
        <button onClick={() => setAccount(false)} className={LINK}>Back</button>
      </div>
    );
  }
  return (
    <Centre>
      <Avatar name={name ?? "?"} size={52} tone="sky" />
      <span className="text-[12px] font-extrabold text-soft">Friend request</span>
      <H3>{name ? `${name} wants to play you` : "A friend wants to play you"}</H3>
      <Sub>Add them and you can start a game with one tap.</Sub>
      {user ? (
        <div className="grid gap-[9px] w-full">
          <button onClick={() => { setBusy(true); void add().finally(() => setBusy(false)); }} disabled={busy} className={GOLD}>
            {busy ? "Adding…" : name ? `Add ${name}` : "Add them"}
          </button>
          {error && <p className="text-[13px] font-bold text-ember-lo" role="alert">{error}</p>}
          <button onClick={() => nav("/")} className={LINK}>Not now</button>
        </div>
      ) : (
        <form className="grid gap-[9px] w-full text-left" noValidate onSubmit={(e) => { e.preventDefault(); void join(); }}>
          <div className="grid gap-1.5">
            <Input value={guestName} placeholder="Your name" aria-label="Your name" autoCapitalize="words" maxLength={20}
              onChange={(e) => { setGuestName(e.target.value); setNameErr(null); }} />
            {(nameErr ?? error) && <span className="text-[13px] font-bold text-ember-lo" role="alert">{nameErr ?? error}</span>}
          </div>
          <button type="submit" disabled={busy} className={GOLD}>{busy ? "One second…" : name ? `Add ${name}` : "Add them"}</button>
          <button type="button" onClick={() => setAccount(true)} className={`${LINK} mx-auto`}>I have an account</button>
        </form>
      )}
    </Centre>
  );
}
