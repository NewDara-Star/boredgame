import { useState } from "react";
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
    <div className="piece bg-pop p-5">
      <h2 className="font-display text-[22px] leading-tight font-semibold">Just play</h2>
      <p className="text-sm font-semibold mt-1 opacity-80">
        {note ?? "Type a name and you're in. No password, nothing to remember."}
      </p>
      <form className="space-y-3 mt-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null); setBusy(true);
          const { error } = await signInAsGuest(name);
          setBusy(false);
          if (error) setError(error);
        }}>
        <Field label="What should we call you?" error={error}>
          <Input required value={name} placeholder="Tayo" autoCapitalize="words"
            maxLength={20} minLength={3} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? "One second…" : "Start playing"}
        </Button>
      </form>
      <p className="text-[11px] font-bold opacity-70 mt-3">
        You can turn this into a proper account later and keep your games.
      </p>
    </div>
  );
}

/**
 * Shown to a guest once they have something to lose. Deliberately not shown on
 * arrival: asking someone to make an account before they have played is the
 * thing this whole flow exists to avoid.
 */
export function ClaimCard() {
  const { profile, claimAccount } = useAuth();
  const [name, setName] = useState(profile?.username ?? "");
  const [password, setPassword] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="piece press w-full bg-sand px-4 py-3 text-left">
        <span className="block font-display text-base font-semibold">Keep this name</span>
        <span className="block text-[12px] font-bold text-soft mt-0.5">
          Add a password and your games, streak and rank stick around.
        </span>
      </button>
    );
  }

  return (
    <form className="piece p-5 space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null); setBusy(true);
        const { error } = await claimAccount(name, password);
        setBusy(false);
        if (error) setError(error); else setOpen(false);
      }}>
      <p className="font-display text-lg font-semibold">Keep this name</p>
      <Field label="Name" error={error}>
        <Input required value={name} autoCapitalize="none" maxLength={20}
          onChange={(e) => setName(e.target.value)} />
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
