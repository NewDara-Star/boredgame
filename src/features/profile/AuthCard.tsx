import { useState } from "react";
import { useAuth } from "@/app/providers/AuthProvider";
import { Button } from "@/shared/ui/Button";
import { Field, Input } from "@/shared/ui/Field";

/**
 * Signing up is the default, not signing in. Someone who already has an account
 * knows to look for the other tab; a first-time player who lands on a login form
 * assumes the app is not for them yet and leaves.
 */
export function AuthCard({ kept }: { kept?: string }) {
  const { signIn, signUp, signInWithLink } = useAuth();
  const [mode, setMode] = useState<"signup" | "signin">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (sent) {
    return (
      <div className="piece bg-good text-surface p-5">
        <p className="font-display text-lg font-semibold">Check your email</p>
        <p className="text-sm font-semibold mt-1">There's a sign-in link waiting for you.</p>
      </div>
    );
  }

  return (
    <div className="piece p-5">
      <h2 className="font-display text-[22px] leading-tight font-semibold">
        {mode === "signup" ? "Create an account" : "Welcome back"}
      </h2>
      <p className="text-sm text-soft font-semibold mt-1">
        {mode === "signup"
          ? kept ?? "Keeps your rank, streak and place on the leaderboard across devices."
          : "Sign in to pick up where you left off."}
      </p>

      <form className="space-y-3 mt-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null); setBusy(true);
          const { error } = await (mode === "signin" ? signIn : signUp)(email, password);
          setBusy(false);
          if (error) setError(error);
        }}>
        <Field label="Email" error={error}>
          <Input type="email" required value={email} placeholder="you@example.com"
            autoComplete="email" onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Password" hint={mode === "signup" ? "At least 6 characters" : undefined}>
          <Input type="password" required minLength={6} value={password} placeholder="••••••••"
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? "Working…" : mode === "signup" ? "Create account" : "Sign in"}
        </Button>
      </form>

      <div className="flex items-center gap-2 mt-4 pt-4 border-t-2 border-sand">
        <p className="text-xs font-bold text-soft">
          {mode === "signup" ? "Already have one?" : "New here?"}
        </p>
        <button type="button"
          onClick={() => { setMode(mode === "signup" ? "signin" : "signup"); setError(null); }}
          className="text-xs font-black uppercase tracking-wider underline underline-offset-4">
          {mode === "signup" ? "Sign in" : "Create an account"}
        </button>
      </div>

      <button type="button"
        onClick={async () => {
          if (!email) { setError("Enter your email first."); return; }
          setBusy(true);
          const { error } = await signInWithLink(email);
          setBusy(false);
          if (error) setError(error); else setSent(true);
        }}
        className="w-full text-xs font-bold text-soft underline underline-offset-4 pt-3">
        Email me a link instead
      </button>
    </div>
  );
}
