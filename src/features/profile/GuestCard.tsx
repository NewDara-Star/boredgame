import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/app/providers/AuthProvider";
import { Button } from "@/shared/ui/Button";
import { Field, Input } from "@/shared/ui/Field";

/**
 * One field, and you are in the room.
 *
 * Rooms used to require an account, and "a name and a password" is exactly
 * where a nine-year-old sister or a grandparent stops — not because it is hard,
 * but because it reads as a commitment before they have seen the thing. This is
 * the same account underneath, minus the password, and it can be turned into a
 * real one later without losing anything.
 */
export function GuestCard({ note }: { note?: string }) {
  const { signInAsGuest } = useAuth();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="card bg-petal p-5">
      <h2 className="font-display text-[22px] leading-tight font-semibold">Just play</h2>
      <p className="text-sm font-semibold mt-1 opacity-80">
        {note ?? "Type a name and you're in. No password, nothing to remember."}
      </p>
      <form className="space-y-3 mt-4" noValidate
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null); setBusy(true);
          const { error } = await signInAsGuest(name);
          setBusy(false);
          if (error) setError(error);
        }}>
        <Field label="What should we call you?" error={error}>
          <Input value={name} placeholder="Tayo" autoCapitalize="words"
            maxLength={20} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? "One second…" : "Start playing"}
        </Button>
      </form>
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
export function ClaimCard() {
  const { profile, claimAccount, checkName, claimedAs, clearClaimed } = useAuth();
  const [name, setName] = useState(profile?.username ?? "");
  const [password, setPassword] = useState("");
  const [open, setOpen] = useState(false);
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
    <form className="card p-5 space-y-3" noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null); setBusy(true);
        const { error } = await claimAccount(name, password);
        setBusy(false);
        if (error) setError(error);
      }}>
      <p className="font-display text-lg font-semibold">Keep this name</p>
      <Field label="Name" error={error ?? (live.state === "bad" ? live.text : null)}
        hint={error ? undefined : live.state === "ok" ? live.text : live.state === "checking" ? "Checking…" : undefined}>
        <Input value={name} autoCapitalize="none" maxLength={20}
          onChange={(e) => { setName(e.target.value); setError(null); }} />
      </Field>
      <Field label="Password" hint="At least 6 characters">
        <Input type="password" required minLength={6} value={password} placeholder="••••••••"
          autoComplete="new-password" onChange={(e) => setPassword(e.target.value)} />
      </Field>
      <Button type="submit" disabled={busy} className="w-full">
        {busy ? "Saving…" : "Save my account"}
      </Button>
    </form>
  );
}

/**
 * The live check under a name field: quiet while you type, then either the
 * name is free or the sentence that says why not. Only the latest answer is
 * shown, however the requests come back.
 */
function useNameCheck(name: string, check: (n: string) => Promise<string | null>) {
  const [res, setRes] = useState<{ state: "idle" | "checking" | "ok" | "bad"; text: string; for: string }>(
    { state: "idle", text: "", for: "" });
  // The provider hands over a new function every render; only the name matters.
  const checkRef = useRef(check);
  checkRef.current = check;
  useEffect(() => {
    const n = name.trim();
    if (!n) { setRes({ state: "idle", text: "", for: "" }); return; }
    let live = true;
    setRes({ state: "checking", text: "", for: n });
    const t = setTimeout(() => {
      void checkRef.current(n).then((why) => {
        if (live) setRes(why ? { state: "bad", text: why, for: n } : { state: "ok", text: `${n} is yours to keep.`, for: n });
      });
    }, 400);
    return () => { live = false; clearTimeout(t); };
  }, [name]);
  return res;
}
