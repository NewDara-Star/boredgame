import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useAuth, isSynthetic } from "@/app/providers/AuthProvider";
import { useProgress } from "@/features/play/useProgress";
import { rankFor, RANKS } from "@/features/play/rank";
import { Note } from "@/shared/ui/Note";
import { RankBadge } from "@/features/play/RankBadge";
import { MILESTONES } from "@/features/play/streak";
import { Avatar } from "@/shared/ui/Avatar";
import { Button } from "@/shared/ui/Button";
import { Field, Input } from "@/shared/ui/Field";
import { stagger, riseIn, popIn } from "@/shared/ui/motion";
import { AuthCard } from "./AuthCard";
import { ClaimCard } from "./GuestCard";
import { takeLinkError } from "@/shared/lib/linkError";
import { readCarry } from "@/features/play/carry";

/** A number worth looking at, with a word under it. That is the whole card. */
function Stat({ value, label, accent = "" }:
  { value: string | number; label: string; accent?: string }) {
  return (
    <motion.div variants={popIn} className={`card p-3.5 ${accent}`}>
      <b className="block font-display text-[28px] leading-none font-semibold tabular-nums">{value}</b>
      <span className="block text-[12px] font-black text-soft mt-1.5">
        {label}
      </span>
    </motion.div>
  );
}

/** Supabase reports a failed magic link in the URL fragment. Without reading it,
    a broken link looks identical to never having clicked one. */
function useLinkError() {
  // Read when the app started (shared/lib/linkError), whichever page the link
  // landed on; taken once, so it doesn't come back on the next visit.
  const [authError] = useState<string | null>(takeLinkError);
  return authError;
}

/**
 * What a signed-out player sees. It used to be the full dashboard with the sign-in
 * form buried under four sections, which read as "you are already logged in" and
 * hid the only action on the page.
 */
function GuestView({ authError }: { authError: string | null }) {
  const p = useProgress();
  const { current } = rankFor(p.answered);
  const played = p.answered > 0;
  const kept = readCarry().rows.length;   // what an account made now takes with it (F17)

  return (
    <motion.div variants={stagger(0.07)} initial="hidden" animate="show" className="space-y-4">
      <motion.div variants={riseIn}>
        <p className="text-[12px] font-black text-soft">Account</p>
        <h1 className="font-display text-[32px] leading-none font-semibold mt-1">
          {played ? "Keep your progress" : "Save your progress"}
        </h1>
      </motion.div>

      {authError && (
        <Note animate title="Sign-in didn't complete">{authError}</Note>
      )}

      <motion.div variants={riseIn}>
        <AuthCard kept={kept > 0
          ? `${kept} answer${kept === 1 ? "" : "s"} from this phone come with you when you make an account, with up to 7 days of streak.`
          : undefined} />
      </motion.div>

      {/* Shown as a small aside, not as a dashboard — it is what you stand to keep,
          not a profile you already have. */}
      <motion.div variants={riseIn} className="card p-4 flex items-center gap-3">
        <RankBadge rank={current.key} size={38} />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold">
            {played ? `Playing signed out: ${current.name}, ${p.answered} answered` : "Playing signed out"}
          </p>
          <p className="text-[13px] font-bold text-soft mt-0.5">
            Kept on this phone until you make an account. Clearing site data loses it.
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}

/** The dashboard, for someone who actually has an account. */
function MemberView() {
  const { user, profile, signOut, setPassword: savePassword, setUsername, isGuest, claimedAs } = useAuth();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [pwDone, setPwDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState(profile?.username ?? "");
  const [nameBusy, setNameBusy] = useState(false);
  const [nameNote, setNameNote] = useState<string | null>(null);
  const [nameMsg, setNameMsg] = useState<string | null>(null);
  const [nameErr, setNameErr] = useState<string | null>(null);
  useEffect(() => { setDraft(profile?.username ?? ""); }, [profile?.username]);
  // The signup trigger makes prefix_abcd. Anyone still carrying one has never
  // chosen a name, and is about to appear on a public board under it.
  const generated = /_[0-9a-f]{4}$/.test(profile?.username ?? "");

  const p = useProgress();
  const { current, next, progress } = rankFor(p.answered);
  const name = profile?.username ?? "You";
  const best = Math.max(p.bestScore.picto ?? 0, p.bestScore.trivia ?? 0);

  return (
    <motion.div variants={stagger(0.06)} initial="hidden" animate="show" className="space-y-7">
      <motion.section variants={riseIn} className="flex items-center gap-4">
        <Avatar id={user?.id ?? "anon"} name={name} size={62} />
        <div className="min-w-0">
          <h1 className="font-display text-[26px] leading-tight font-semibold truncate">{name}</h1>
          <p className="text-xs font-bold text-soft mt-0.5 truncate">
            {isSynthetic(user?.email) ? "Signed in" : user?.email}
          </p>
        </div>
        <div className="flex-1" />
        <RankBadge rank={current.key} size={54} animate className="shrink-0" />
      </motion.section>

      <motion.div variants={riseIn} className="card p-4">
        <div className="flex items-baseline justify-between gap-3">
          <span className="font-display text-xl font-semibold">{current.name}</span>
          <span className="text-xs font-bold text-soft tabular-nums">
            {next ? `${next.min - p.answered} to ${next.name}` : "Top rank"}
          </span>
        </div>
        <div className="h-3.5 bg-mist rounded-full mt-2.5 overflow-hidden shadow-lift-sm">
          <motion.div className="h-full bg-petal"
            initial={{ width: 0 }} animate={{ width: `${Math.round(progress * 100)}%` }}
            transition={{ type: "spring", stiffness: 90, damping: 18, delay: 0.3 }} />
        </div>
      </motion.div>

      <motion.section variants={stagger(0.05)} className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <Stat value={p.streak} label="Day streak" accent={p.streak > 0 ? "bg-petal" : ""} />
        <Stat value={p.answered} label="Answered" />
        <Stat value={p.answered ? Math.round((p.correct / p.answered) * 100) + "%" : "—"} label="Accuracy" />
        <Stat value={best || "—"} label="Best round" />
      </motion.section>

      <section>
        <p className="text-[12px] font-black text-soft mb-2.5">
          Streaks · best run {p.bestStreak} {p.bestStreak === 1 ? "day" : "days"}
        </p>
        <motion.div variants={stagger(0.04)} className="grid grid-cols-6 gap-2">
          {MILESTONES.map((m) => {
            const earned = p.bestStreak >= m.days;
            return (
              <motion.div key={m.days} variants={popIn} title={m.name}
                className={`card grid place-items-center aspect-square
                  ${earned ? "bg-petal" : "bg-mist opacity-45"}`}>
                <span className="font-display text-lg font-semibold tabular-nums leading-none">{m.days}</span>
                {/* No tracking: at 12px in a 53px square the trailing letter-space put
                    "DAY" exactly on the boundary. Size is what has to be legible. */}
                <span className="text-[12px] font-black text-soft">day</span>
              </motion.div>
            );
          })}
        </motion.div>
      </section>

      <section>
        <p className="text-[12px] font-black text-soft mb-2.5">
          Ranks · {RANKS.filter((r) => p.answered >= r.min).length} of {RANKS.length}
        </p>
        <motion.div variants={stagger(0.035)} className="grid grid-cols-3 sm:grid-cols-5 gap-2.5">
          {RANKS.map((rk) => {
            const locked = p.answered < rk.min;
            return (
              <motion.div key={rk.key} variants={popIn}
                className={`card px-2 py-3 text-center ${locked ? "bg-mist" : ""}`}>
                <div className="h-10 grid place-items-center">
                  <RankBadge rank={rk.key} size={36} locked={locked} />
                </div>
                {/* No tracking and a hard break: "Accomplished" next to "Advanced"
                    collided at phone width with letter-spacing applied. */}
                <p className={`text-[12px] font-black mt-1.5 leading-[1.15] break-words
                  ${locked ? "text-soft/60" : "text-ink"}`}>{rk.name}</p>
                <p className="text-[12px] font-bold text-soft/60 tabular-nums leading-tight mt-0.5">
                  {locked ? `${rk.min - p.answered} to go` : "unlocked"}
                </p>
              </motion.div>
            );
          })}
        </motion.div>
      </section>

      <motion.section variants={riseIn}
        className={`card p-4 ${generated ? "bg-petal" : ""}`}>
        <p className="text-[12px] font-black text-soft">Your name</p>
        <p className="text-[13px] font-semibold mt-1">
          {generated
            ? "This one was made up for you at signup. Pick something before anyone sees you on the leaderboard."
            : "How you appear in rooms and on the leaderboard."}
        </p>
        <form className="flex gap-2 mt-3" noValidate
          onSubmit={async (e) => {
            e.preventDefault();
            setNameErr(null); setNameMsg(null); setNameNote(null); setNameBusy(true);
            const { error } = await setUsername(draft);
            setNameBusy(false);
            if (error) setNameErr(error);
            else {
              setNameMsg("Saved");
              if (isSynthetic(user?.email)) setNameNote(`You'll sign in as ${draft.trim()} from now on.`);
            }
          }}>
          <Input value={draft} onChange={(e) => { setDraft(e.target.value); setNameMsg(null); setNameNote(null); setNameErr(null); }}
            maxLength={20} placeholder="yourname" autoComplete="off" />
          <Button type="submit" variant="ghost"
            disabled={nameBusy || !draft.trim() || draft === profile?.username}>
            {nameBusy ? "…" : nameMsg ?? "Save"}
          </Button>
        </form>
        {nameErr && <p className="text-[12px] font-bold text-ember mt-2">{nameErr}</p>}
        {nameNote && !nameErr && <p className="text-[12px] font-bold mt-2" role="status">{nameNote}</p>}
      </motion.section>

      {(isGuest || claimedAs) ? (
        <section className="border-t-2 border-mist pt-6 space-y-4">
          <ClaimCard />
          {isGuest && <StartOver name={profile?.username ?? null} signOut={signOut} />}
        </section>
      ) : (
      <section className="border-t-2 border-mist pt-6 space-y-4">
        <form className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setError(null); setBusy(true);
            const { error } = await savePassword(password);
            setBusy(false);
            if (error) setError(error); else { setPwDone(true); setPassword(""); }
          }}>
          <Field label="Set a password"
            hint="Accounts made with a magic link have none. Set one and you can sign in without email."
            error={error}>
            <Input type="password" required minLength={6} value={password} placeholder="••••••••"
              autoComplete="new-password" onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <Button type="submit" disabled={busy} variant="secondary" className="w-full">
            {busy ? "Saving…" : pwDone ? "Password saved" : "Save password"}
          </Button>
        </form>
        <SignOut name={profile?.username ?? null} signOut={signOut} />
      </section>
      )}
    </motion.div>
  );
}

export function ProfilePage() {
  const { user, offline } = useAuth();
  const authError = useLinkError();

  if (offline) {
    return (
      <div className="card p-6">
        <h1 className="font-display text-2xl font-semibold">No account needed yet</h1>
        <p className="text-sm text-soft font-semibold mt-2">
          There is no backend configured, so progress is saved in this browser only.
          Add Supabase keys for accounts, sync and head-to-head.
        </p>
      </div>
    );
  }
  return user ? <MemberView /> : <GuestView authError={authError} />;
}

/**
 * Sign out asks once, and says what happens (F5): a member's games are on the
 * server, so the sheet says so and names the sign-in to come back with.
 */
function SignOut({ name, signOut }: { name: string | null; signOut: () => Promise<void> }) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!asking) {
    return <Button variant="ghost" className="w-full" onClick={() => setAsking(true)}>Sign out</Button>;
  }
  return (
    <div className="card p-4 space-y-3" role="alertdialog" aria-label="Sign out?">
      <p className="text-sm font-semibold">Your games are saved. Sign back in as {name ?? "your name"}.</p>
      <div className="flex gap-2">
        <Button variant="ghost" className="flex-1" onClick={() => setAsking(false)} disabled={busy}>Stay</Button>
        <Button className="flex-1" disabled={busy}
          onClick={async () => { setBusy(true); await signOut(); }}>
          {busy ? "Signing out…" : "Sign out"}
        </Button>
      </div>
    </div>
  );
}

/**
 * A guest has no sign-in to come back with, so there is no Sign out (F12): a
 * guest who signed out lost everything, and nothing said so. Saving comes first
 * and big (the ClaimCard above); starting over is small, and says plainly that
 * it's for good.
 */
function StartOver({ name, signOut }: { name: string | null; signOut: () => Promise<void> }) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!asking) {
    return (
      <button onClick={() => setAsking(true)}
        className="block mx-auto text-[12px] font-bold text-soft underline underline-offset-4">
        Start over as someone new
      </button>
    );
  }
  return (
    <div className="card bg-petal-hi p-4 space-y-3" role="alertdialog" aria-label="Start over?">
      <p className="text-sm font-semibold">
        This loses {name ? `${name}'s` : "these"} games, streak and friends for good. There's no way back.
      </p>
      <div className="flex gap-2">
        <Button className="flex-1" onClick={() => setAsking(false)} disabled={busy}>Keep playing</Button>
        <Button variant="ghost" className="flex-1" disabled={busy}
          onClick={async () => { setBusy(true); await signOut(); }}>
          {busy ? "One moment…" : "Start over"}
        </Button>
      </div>
    </div>
  );
}
