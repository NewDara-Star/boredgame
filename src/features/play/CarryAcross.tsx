import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/app/providers/AuthProvider";
import { Button } from "@/shared/ui/Button";
import { readCarry, hasCarry, madeHere, decline, sendCarry } from "./carry";
import { handOver } from "./progress";

const answers = (n: number) => `${n} answer${n === 1 ? "" : "s"}`;

/**
 * Hands play from before you signed in to your account (F17, talk item 3).
 * An account made on this phone just now takes it without a question. Any
 * other account is asked first, because on a shared phone the play here may be
 * someone else's; "Not mine" isn't asked again for that account.
 */
export function CarryAcross() {
  const { user, profile, applyProfile } = useAuth();
  const [ask, setAsk] = useState<number | null>(null);
  const [said, setSaid] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const tried = useRef<string | null>(null);

  async function carry(userId: string, asked: boolean) {
    setBusy(true); setFailed(false);
    const n = readCarry().rows.length;
    const p = await sendCarry();
    setBusy(false);
    if (!p || p.id !== userId) { if (asked) setFailed(true); return; }
    handOver(userId);
    applyProfile(p);
    setAsk(null);
    setSaid(n > 0
      ? `The ${answers(n)} played on this phone ${asked ? "are" : "from before you signed up are"} on your account now.`
      : "The days played on this phone are on your streak now.");
  }

  useEffect(() => {
    setAsk(null); setSaid(null); setFailed(false);
    if (!user || !profile || profile.id !== user.id) return;
    if (tried.current === user.id) return;
    const c = readCarry();
    if (!hasCarry(c) || c.declined.includes(user.id)) return;
    tried.current = user.id;
    if (madeHere(user.created_at, c)) void carry(user.id, false);
    else setAsk(c.rows.length);
  }, [user?.id, profile?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (said) {
    return (
      <div className="card p-4 mb-4 flex items-start gap-3" role="status">
        <p className="text-sm font-semibold flex-1">{said}</p>
        <button onClick={() => setSaid(null)} className="text-[13px] font-bold underline underline-offset-4">
          OK
        </button>
      </div>
    );
  }
  if (ask === null || !user) return null;
  const name = profile?.username ?? "this account";
  return (
    <div className="card p-4 mb-4 space-y-3" role="alertdialog" aria-label="Add the play on this phone?">
      <p className="font-display text-lg font-semibold leading-tight">
        {ask > 0 ? `Add ${answers(ask)} played on this phone to ${name}?` : `Add the days played on this phone to ${name}'s streak?`}
      </p>
      <p className="text-[13px] font-semibold text-soft">
        {failed ? "Couldn't add them. Try again." : "They were played here while signed out. Only add them if they're yours."}
      </p>
      <div className="flex gap-2">
        <Button variant="ghost" className="flex-1" disabled={busy}
          onClick={() => { decline(user.id); setAsk(null); }}>
          Not mine
        </Button>
        <Button className="flex-1" disabled={busy} onClick={() => void carry(user.id, true)}>
          {busy ? "Adding…" : "Add them"}
        </Button>
      </div>
    </div>
  );
}
