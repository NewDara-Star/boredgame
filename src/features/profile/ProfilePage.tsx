import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth, isSynthetic } from "@/app/providers/AuthProvider";
import { useProgress } from "@/features/play/useProgress";
import { rankFor, RANKS } from "@/features/play/rank";
import { Note } from "@/shared/ui/Note";
import { RankBadge } from "@/features/play/RankBadge";
import { Avatar } from "@/shared/ui/Avatar";
import { Button } from "@/shared/ui/Button";
import { Field, Input } from "@/shared/ui/Field";
import { stagger, riseIn, popIn } from "@/shared/ui/motion";
import { AuthCard } from "./AuthCard";
import { ClaimCard, useNameCheck } from "./GuestCard";
import { IconFlame } from "@/app/layout/Icons";
import { NotificationsCard } from "@/features/push/Notifications";
import { useLeaderboard, type Standing } from "@/features/leaderboard/useLeaderboard";
import { takeLinkError } from "@/shared/lib/linkError";
import { readCarry } from "@/features/play/carry";

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
        <h1 className="font-display text-[34px] leading-none font-semibold">You</h1>
        <p className="text-sm text-soft font-semibold mt-2">
          {played ? "Keep your progress: make an account, or sign in." : "Save your progress: make an account, or sign in."}
        </p>
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

/** The page title, the same on every You screen (#46, #51). */
function Title() {
  return <motion.h1 variants={riseIn} className="font-display text-[34px] leading-none font-semibold">You</motion.h1>;
}

/** Your rank, big: the badge, the name and what it took (#46, #51). */
function RankCard({ answered, line }: { answered: number; line: ReactNode }) {
  const { current, next, progress } = rankFor(answered);
  return (
    <motion.section variants={riseIn} className="card p-4 flex items-center gap-4">
      <RankBadge rank={current.key} size={64} animate className="shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="font-display text-[26px] leading-none font-semibold">{current.name}</p>
        <p className="text-[13px] font-bold mt-1.5 tabular-nums">{line}</p>
        {next && (
          <>
            <div className="h-2.5 bg-mist rounded-full mt-2 overflow-hidden">
              <motion.div className="h-full bg-petal" initial={{ width: 0 }} animate={{ width: `${Math.round(progress * 100)}%` }}
                transition={{ type: "spring", stiffness: 90, damping: 18, delay: 0.3 }} />
            </div>
            <p className="text-[12px] font-bold text-soft mt-1 tabular-nums">{next.min - answered} more to {next.name}</p>
          </>
        )}
      </div>
    </motion.section>
  );
}

/** All ten ranks in a row; tapping it opens the road (#46 → #48). */
function Ladder({ answered }: { answered: number }) {
  return (
    <motion.div variants={riseIn}>
      <Link to="/you/road" className="card tap block p-4">
        <span className="flex items-baseline justify-between">
          <span className="text-[12px] font-black text-soft">
            All ten ranks · {RANKS.filter((r) => answered >= r.min).length} of {RANKS.length}
          </span>
          <span className="text-[13px] font-black">See the road →</span>
        </span>
        <span className="grid grid-cols-10 gap-0.5 mt-3 items-end">
          {RANKS.map((rk) => (
            <span key={rk.key} className="grid place-items-center">
              <RankBadge rank={rk.key} size={26} locked={answered < rk.min} />
            </span>
          ))}
        </span>
      </Link>
    </motion.div>
  );
}

/** A number worth looking at, with a word under it. That is the whole card. */
function Stat({ value, label, accent = "" }: { value: string | number; label: string; accent?: string }) {
  return (
    <motion.div variants={popIn} className={`card p-3 ${accent}`}>
      <b className="block font-display text-[26px] leading-none font-semibold tabular-nums">{value}</b>
      <span className="block text-[12px] font-black text-soft mt-1.5">{label}</span>
    </motion.div>
  );
}

/** Where you stand, in two rows: the top of the board and you (#47 → #49). */
function Standing1({ p, me }: { p: Standing; me: boolean }) {
  return (
    <div className={`flex items-center gap-3 rounded-2xl px-2 py-2 ${me ? "bg-petal" : ""}`}>
      <span className="w-7 text-center font-display text-lg font-semibold tabular-nums">{p.position}</span>
      <Avatar id={p.id} name={p.username} size={32} />
      <span className="min-w-0 flex-1">
        <span className="block font-bold text-[15px] truncate">{me ? "You" : p.username}</span>
        <span className="block text-[12px] font-bold text-soft tabular-nums">{p.answered.toLocaleString()} answered</span>
      </span>
      <RankBadge rank={rankFor(p.answered).current.key} size={26} />
    </div>
  );
}

function EveryoneCard({ userId }: { userId?: string }) {
  const { rows, you, loading, failed } = useLeaderboard(userId, 1);
  return (
    <motion.section variants={riseIn} className="card p-3">
      <div className="flex items-baseline justify-between px-2 pt-1">
        <p className="text-[12px] font-black text-soft">Everyone</p>
        <Link to="/you/everyone" className="text-[13px] font-black py-2">See all →</Link>
      </div>
      {loading ? <p className="text-[13px] font-bold text-soft px-2 pb-2">One moment…</p>
        : failed ? <p className="text-[13px] font-bold text-soft px-2 pb-2">Couldn't load the board. It's there under See all.</p>
        : rows.length === 0 ? <p className="text-[13px] font-bold text-soft px-2 pb-2">Nobody's on it yet. Answer one question and the top spot is yours.</p>
        : (
          <div className="grid gap-1">
            <Standing1 p={rows[0]} me={rows[0].id === userId} />
            {you && you.id !== rows[0].id && <Standing1 p={you} me />}
          </div>
        )}
    </motion.section>
  );
}

/** A sheet from the bottom with one job (#50). Tapping outside closes it. */
function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 grid items-end" role="dialog" aria-modal="true" aria-label={title}>
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-ink/50" />
      <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        className="relative bg-board rounded-t-[26px] px-4 pt-3 pb-[calc(18px+env(safe-area-inset-bottom))] max-w-3xl w-full mx-auto space-y-3">
        <div className="w-10 h-1.5 rounded-full bg-mist mx-auto" />
        <p className="font-display text-[22px] leading-tight font-semibold">{title}</p>
        {children}
      </motion.div>
    </div>
  );
}

/** Change your name: one field, checked as you type, then Save (#50, F10). */
function NameSheet({ onClose }: { onClose: () => void }) {
  const { user, profile, setUsername, checkName } = useAuth();
  const [draft, setDraft] = useState(profile?.username ?? "");
  const [nameBusy, setNameBusy] = useState(false);
  const [nameMsg, setNameMsg] = useState<string | null>(null);
  const [nameNote, setNameNote] = useState<string | null>(null);
  const [nameErr, setNameErr] = useState<string | null>(null);
  const changed = draft.trim() !== "" && draft !== profile?.username;
  const live = useNameCheck(changed && !nameMsg ? draft : "", (n) => checkName(n), (n) => `${n} is free.`);
  return (
    <Sheet title="Change your name" onClose={onClose}>
      <form className="space-y-3" noValidate
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
        <Field label="Name" error={nameErr ?? (live.state === "bad" ? live.text : null)}
          hint={nameErr ? undefined : live.state === "ok" ? live.text : live.state === "checking" ? "Checking…" : "Friends and the leaderboard see the new name straight away."}>
          <Input value={draft} onChange={(e) => { setDraft(e.target.value); setNameMsg(null); setNameNote(null); setNameErr(null); }}
            maxLength={20} placeholder="yourname" autoComplete="off" autoCapitalize="none" />
        </Field>
        {nameNote && !nameErr && <p className="text-[13px] font-bold" role="status">{nameNote}</p>}
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>{nameMsg ? "Done" : "Cancel"}</Button>
          <Button type="submit" disabled={nameBusy || !changed || !!nameMsg}>
            {nameBusy ? "…" : nameMsg ?? "Save"}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}

/** Set or change the password (#50). */
function PasswordSheet({ onClose, has }: { onClose: () => void; has: boolean }) {
  const { setPassword: savePassword } = useAuth();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Sheet title={has ? "Change your password" : "Set a password"} onClose={onClose}>
      <form className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null); setBusy(true);
          const { error } = await savePassword(password);
          setBusy(false);
          if (error) setError(error); else { setDone(true); setPassword(""); }
        }}>
        <Field label="New password" hint={done ? "Saved. Use it next time you sign in." : "At least 6 characters"} error={error}>
          <Input type="password" required minLength={6} value={password} placeholder="••••••••"
            autoComplete="new-password" onChange={(e) => { setPassword(e.target.value); setDone(false); }} />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>{done ? "Done" : "Cancel"}</Button>
          <Button type="submit" disabled={busy || password.length === 0}>{busy ? "Saving…" : done ? "Saved" : "Save"}</Button>
        </div>
      </form>
    </Sheet>
  );
}

/** One line of the Account card: what it is, what it's set to, and Change. */
function AccountRow({ label, value, action, onClick }: { label: string; value: string; action: string; onClick: () => void }) {
  return (
    <div className="flex items-center gap-3 py-1">
      <span className="min-w-0 flex-1">
        <span className="block text-[12px] font-black text-soft">{label}</span>
        <span className="block font-bold truncate">{value}</span>
      </span>
      <button onClick={onClick} className="text-[13px] font-black underline underline-offset-4 min-h-[44px] px-2">{action}</button>
    </div>
  );
}

/** You, signed in (#46 top, #47 further down). */
function MemberView() {
  const { user, profile, signOut } = useAuth();
  const [sheet, setSheet] = useState<"name" | "password" | null>(null);
  const p = useProgress();
  const name = profile?.username ?? "You";
  const best = Math.max(p.bestScore.picto ?? 0, p.bestScore.trivia ?? 0);
  // The signup trigger makes prefix_abcd. Anyone still carrying one has never
  // chosen a name, and is about to appear on a public board under it.
  const generated = /_[0-9a-f]{4}$/.test(profile?.username ?? "");
  const since = profile?.created_at ?? user?.created_at;
  const hasPassword = isSynthetic(user?.email);   // a name account always has one; an email one may not

  return (
    <motion.div variants={stagger(0.06)} initial="hidden" animate="show" className="space-y-4 pb-6">
      <Title />
      <motion.section variants={riseIn} className="flex items-center gap-3">
        <Avatar id={user?.id ?? "anon"} name={name} size={52} />
        <div className="min-w-0 flex-1">
          <p className="font-display text-[22px] leading-tight font-semibold truncate">{name}</p>
          {since && (
            <p className="text-[13px] font-bold text-soft">
              Playing since {new Date(since).toLocaleDateString(undefined, { month: "long", year: new Date(since).getFullYear() === new Date().getFullYear() ? undefined : "numeric" })}
            </p>
          )}
        </div>
        {p.streak > 0 && (
          <span className="chip flex items-center gap-1 bg-board text-ink px-2.5 py-1 text-[14px] font-black tabular-nums shrink-0"
            title={`${p.streak}-day streak`}>
            <IconFlame /> {p.streak}
          </span>
        )}
      </motion.section>

      <RankCard answered={p.answered} line={`${p.answered.toLocaleString()} questions answered`} />
      <Ladder answered={p.answered} />

      <motion.section variants={stagger(0.05)} className="grid grid-cols-3 gap-2.5">
        <Stat value={p.streak} label="Day streak" accent={p.streak > 0 ? "bg-petal" : ""} />
        <Stat value={p.answered ? Math.round((p.correct / p.answered) * 100) + "%" : "—"} label="Right" />
        <Stat value={best || "—"} label="Best round" />
      </motion.section>

      <EveryoneCard userId={user?.id} />

      <motion.section variants={riseIn} className={`card p-4 ${generated ? "bg-petal" : ""}`}>
        <p className="text-[12px] font-black text-soft">Account</p>
        {generated && (
          <p className="text-[13px] font-semibold mt-1">
            This name was made up for you at signup. Pick your own before anyone sees you on the leaderboard.
          </p>
        )}
        <AccountRow label="Name" value={name} action="Change" onClick={() => setSheet("name")} />
        <AccountRow label="Password" value={hasPassword ? "Set" : "Not set"} action={hasPassword ? "Change" : "Set"}
          onClick={() => setSheet("password")} />
      </motion.section>

      <motion.div variants={riseIn}><NotificationsCard /></motion.div>

      <motion.div variants={riseIn} className="pt-2">
        <SignOut name={profile?.username ?? null} signOut={signOut} />
      </motion.div>

      {sheet === "name" && <NameSheet onClose={() => setSheet(null)} />}
      {sheet === "password" && <PasswordSheet has={hasPassword} onClose={() => setSheet(null)} />}
    </motion.div>
  );
}

/**
 * You, as a guest (#51, F13). The rank still shows; the account part is one
 * thing: keep all of it. No Sign out and no Set a password (F12): a guest has
 * no sign-in to come back with. Starting over is small, and warned.
 */
function GuestYou() {
  const { profile, signOut, claimedAs } = useAuth();
  const [haveAccount, setHaveAccount] = useState(false);
  const p = useProgress();
  const name = profile?.username ?? null;
  return (
    <motion.div variants={stagger(0.06)} initial="hidden" animate="show" className="space-y-4 pb-6">
      <Title />
      <RankCard answered={p.answered}
        line={`${p.answered.toLocaleString()} answered${p.streak > 0 ? `, ${p.streak}-day streak` : ""}`} />
      {claimedAs ? (
        <motion.div variants={riseIn}><ClaimCard /></motion.div>
      ) : haveAccount ? (
        <motion.div variants={riseIn} className="space-y-2">
          <AuthCard start="signin"
            note={`Signing in leaves ${name ? `${name}'s` : "these"} guest games behind. To keep them, save them instead.`} />
          <button onClick={() => setHaveAccount(false)}
            className="block mx-auto text-[13px] font-black underline underline-offset-4 min-h-[44px]">
            Save my progress instead
          </button>
        </motion.div>
      ) : (
        <motion.section variants={riseIn} className="card bg-leaf-hi p-5 space-y-3">
          <div>
            <p className="font-display text-[22px] leading-tight font-semibold">Keep all of it</p>
            <p className="text-[13px] font-semibold mt-1">
              Kept for 30 days after you last play. Add a password to keep it for good and get on the board.
            </p>
          </div>
          <ClaimCard inline />
          <button onClick={() => setHaveAccount(true)}
            className="block mx-auto text-[13px] font-black underline underline-offset-4 min-h-[44px]">
            I have an account
          </button>
        </motion.section>
      )}
      <Ladder answered={p.answered} />
      {!claimedAs && <StartOver name={name} signOut={signOut} />}
    </motion.div>
  );
}

export function ProfilePage() {
  const { user, offline, isGuest, claimedAs } = useAuth();
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
  if (!user) return <GuestView authError={authError} />;
  // A guest who has just saved stays here until they tap "Got it" on the Saved card.
  return isGuest || claimedAs ? <GuestYou /> : <MemberView />;
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
