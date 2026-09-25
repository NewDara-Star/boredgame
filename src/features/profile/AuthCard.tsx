import { useState } from "react";
import { useAuth } from "@/app/providers/AuthProvider";
import { Button } from "@/shared/ui/Button";
import { Field, Input } from "@/shared/ui/Field";
import { errorField } from "@/shared/lib/names";

/**
 * Signing up is the default, not signing in. Someone who already has an account
 * knows to look for the other tab; a first-time player who lands on a login form
 * assumes the app is not for them yet and leaves.
 */
export function AuthCard({ kept, start = "signup", note }: {
  kept?: string;
  /** A guest who has an account elsewhere starts on Sign in (#51). */
  start?: "signup" | "signin";
  /** A line above the form, e.g. what signing in leaves behind. */
  note?: string;
}) {
  const { signIn, signUp, signInWithLink } = useAuth();
  const [mode, setMode] = useState<"signup" | "signin">(start);
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (sent) {
    return (
      <div className="card bg-leaf text-ink p-5">
        <p className="font-display text-lg font-semibold">Check your email</p>
        <p className="text-sm font-semibold mt-1">There's a sign-in link waiting for you.</p>
      </div>
    );
  }

  return (
    <div className="card p-5">
      <h2 className="font-display text-[22px] leading-tight font-semibold">
        {mode === "signup" ? "Create an account" : "Welcome back"}
      </h2>
      <p className="text-sm text-soft font-semibold mt-1">
        {mode === "signup"
          ? kept ?? "A name and a password. Keeps your rank, streak and place on the leaderboard."
          : "Sign in to pick up where you left off."}
      </p>
      {note && <p className="text-[13px] font-bold mt-2">{note}</p>}

      <form className="space-y-3 mt-4" noValidate
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null); setBusy(true);
          const { error } = await (mode === "signin" ? signIn : signUp)(id, password);
          setBusy(false);
          if (error) setError(error);
        }}>
        {/* No email. Nothing is ever sent to one, so asking for it was a step
            that bought nothing — and it is the same field either way, since an
            address still works for the accounts made before names. */}
        <Field label={mode === "signup" ? "Pick a name" : "Name"}
          hint={mode === "signup" ? "3–20 letters, numbers or underscores. This is what people see." : undefined}
          error={error && errorField(error) === "name" ? error : null}>
          <Input required value={id} placeholder="yourname" autoCapitalize="none"
            autoComplete="username" maxLength={40}
            onChange={(e) => setId(e.target.value)} />
        </Field>
        <Field label="Password" hint={mode === "signup" ? "At least 6 characters" : undefined}
          error={error && errorField(error) === "password" ? error : null}>
          <Input type="password" required minLength={6} value={password} placeholder="••••••••"
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            onChange={(e) => setPassword(e.target.value)} />
        </Field>
        {error && errorField(error) === "form" && (
          <p role="alert" className="text-[13px] font-bold text-ink bg-ember rounded-lg px-2 py-1">{error}</p>
        )}
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? "Working…" : mode === "signup" ? "Create account" : "Sign in"}
        </Button>
      </form>

      <div className="flex items-center gap-2 mt-4 pt-4 border-t-2 border-mist">
        <p className="text-xs font-bold text-soft">
          {mode === "signup" ? "Already have one?" : "New here?"}
        </p>
        <button type="button"
          onClick={() => { setMode(mode === "signup" ? "signin" : "signup"); setError(null); }}
          className="text-xs font-black underline underline-offset-4">
          {mode === "signup" ? "Sign in" : "Create an account"}
        </button>
      </div>

      {/* Only for the accounts that predate names — a link cannot be sent to an
          address that does not exist. */}
      {id.includes("@") && (
        <button type="button"
          onClick={async () => {
            setBusy(true);
            const { error } = await signInWithLink(id);
            setBusy(false);
            if (error) setError(error); else setSent(true);
          }}
          className="w-full text-xs font-bold text-soft underline underline-offset-4 pt-3">
          Email me a link instead
        </button>
      )}

      <p className="text-[13px] font-bold text-soft/70 text-center pt-3 leading-snug">
        There is no password reset yet — nothing can be sent to a name. Pick one you'll remember.
      </p>
    </div>
  );
}
