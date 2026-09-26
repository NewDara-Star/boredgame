import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/app/providers/AuthProvider";
import { Button } from "@/shared/ui/Button";
import { Field, Input } from "@/shared/ui/Field";
import { errorField } from "@/shared/lib/names";

/**
 * One field, and you are in the room.
 *
 * Rooms used to require an account, and "a name and a password" is exactly
 * where a nine-year-old sister or a grandparent stops — not because it is hard,
 * but because it reads as a commitment before they have seen the thing. This is
 * the same account underneath, minus the password, and it can be turned into a
 * real one later without losing anything.
 */
export function GuestCard({ note, bare = false }: {
  note?: string;
  /** Just the name and the button, for a screen that says the rest itself
      (Today's round signed out, #15). */
  bare?: boolean;
}) {
  const { signInAsGuest } = useAuth();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = (
    <form className={`space-y-3 ${bare ? "" : "mt-4"}`} noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null); setBusy(true);
        const { error } = await signInAsGuest(name);
        setBusy(false);
        if (error) setError(error);
      }}>
      <Field label={bare ? "Your name" : "What should we call you?"} error={error}>
        <Input value={name} placeholder="Tayo" autoCapitalize="words"
          maxLength={20} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Button type="submit" disabled={busy} className="w-full">
        {busy ? "One second…" : bare ? "Play" : "Start playing"}
      </Button>
    </form>
  );
  if (bare) return form;

  return (
    <div className="card bg-petal p-5">
      <h2 className="font-display text-[22px] leading-tight font-semibold">Just play</h2>
      <p className="text-sm font-semibold mt-1 opacity-80">
        {note ?? "Type a name and you're in. No password, nothing to remember."}
      </p>
      {form}
      <p className="text-[13px] font-bold opacity-70 mt-3">
        You can turn this into a proper account later and keep your games. Guest games are kept
        for 30 days after you last play.
      </p>
    </div>
  );
}

/**
 * Shown to a guest once they have something to lose. Deliberately not shown on
 * arrival: asking someone to make an account before they have played is the
 * thing this whole flow exists to avoid.
 *
 * Name first, then the login (F4, K): the name is checked as you type, Save
 * takes it on the server before anything else, and only then the password.
 * If the password step fails, the name stays yours and Save tries again.
 */
export function ClaimCard({ inline = false }: {
  /** The You screen for a guest (#51): the form itself, always open, no button to open it. */
  inline?: boolean;
} = {}) {
  const { profile, claimAccount, checkName, claimedAs, clearClaimed } = useAuth();
  const [name, setName] = useState(profile?.username ?? "");
  // The name copied in once, at first sight: if the profile hadn't arrived
  // yet, the box stayed empty (P6). Fill it when it arrives, unless typed in.
  const typed = useRef(false);
  useEffect(() => { if (!typed.current && profile?.username) setName(profile.username); }, [profile?.username]);
  const [password, setPassword] = useState("");
  const [open, setOpen] = useState(inline);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const live = useNameCheck(open ? name : "", checkName);

  if (claimedAs) {
    return (
      <div className="card bg-leaf-hi p-5" role="status">
        <p className="font-display text-lg font-semibold">Saved.</p>
        <p className="text-sm font-semibold mt-1">Next time, sign in as {claimedAs}.</p>
        <button onClick={clearClaimed} className="text-[13px] font-black underline underline-offset-4 mt-3">
          Got it
        </button>
      </div>
    );
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="card tap w-full bg-leaf-hi px-4 py-4 text-left">
        <span className="block font-display text-lg font-semibold">Save my progress</span>
        <span className="block text-[12px] font-bold text-soft mt-0.5">
          Add a password and your games, streak and rank stick around. As a guest, they go 30 days
          after you last play.
        </span>
      </button>
    );
  }

  return (
    <form className={inline ? "space-y-3" : "card p-5 space-y-3"} noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null); setBusy(true);
        const { error } = await claimAccount(name, password);
        setBusy(false);
        if (error) setError(error);
      }}>
      {!inline && <p className="font-display text-lg font-semibold">Keep this name</p>}
      <Field label="Name" error={(error && errorField(error) !== "password" ? error : null) ?? (live.state === "bad" ? live.text : null)}
        hint={error ? undefined : live.state === "ok" ? live.text : live.state === "checking" ? "Checking…" : undefined}>
        <Input value={name} autoCapitalize="none" maxLength={20}
          onChange={(e) => { typed.current = true; setName(e.target.value); setError(null); }} />
      </Field>
      <Field label="Password" hint="At least 6 characters" error={error && errorField(error) === "password" ? error : null}>
        <Input type="password" required minLength={6} value={password} placeholder="••••••••"
          autoComplete="new-password" onChange={(e) => setPassword(e.target.value)} />
      </Field>
      <Button type="submit" disabled={busy} className="w-full">
        {busy ? "Saving…" : inline ? "Save my progress" : "Save my account"}
      </Button>
    </form>
  );
}

/**
 * The live check under a name field: quiet while you type, then either the
 * name is free or the sentence that says why not. Only the latest answer is
 * shown, however the requests come back.
 */
export function useNameCheck(name: string, check: (n: string) => Promise<string | null>,
  okText: (n: string) => string = (n) => `${n} is yours to keep.`) {
  const [res, setRes] = useState<{ state: "idle" | "checking" | "ok" | "bad"; text: string; for: string }>(
    { state: "idle", text: "", for: "" });
  // The provider hands over a new function every render; only the name matters.
  const checkRef = useRef(check);
  checkRef.current = check;
  const okRef = useRef(okText);
  okRef.current = okText;
  useEffect(() => {
    const n = name.trim();
    if (!n) { setRes({ state: "idle", text: "", for: "" }); return; }
    let live = true;
    setRes({ state: "checking", text: "", for: n });
    const t = setTimeout(() => {
      void checkRef.current(n).then((why) => {
        if (live) setRes(why ? { state: "bad", text: why, for: n } : { state: "ok", text: okRef.current(n), for: n });
      });
    }, 400);
    return () => { live = false; clearTimeout(t); };
  }, [name]);
  return res;
}
