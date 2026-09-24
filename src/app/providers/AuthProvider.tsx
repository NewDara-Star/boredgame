import { releasePush } from "@/features/push/release";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase, isConfigured, AUTH_STORAGE_KEY, SERVER } from "@/shared/lib/supabase";

/**
 * Supabase Auth has no username login, so a name becomes an address on a domain
 * nothing ever sends to. That is not a workaround for the uniqueness problem —
 * it IS the uniqueness guarantee: two people cannot hold the same address, so
 * the race for a name is settled by auth rather than by checking first and
 * hoping. Lower-cased, so Dara and dara are the same person.
 */
const HOME = "players.boredgame.app";
export const asLogin = (id: string) =>
  id.includes("@") ? id.trim() : `${id.trim().toLowerCase()}@${HOME}`;
export const isSynthetic = (email?: string | null) => !!email?.endsWith(`@${HOME}`);
import type { Profile } from "@/shared/types/db";
import { sayError, NO_SERVER } from "@/shared/lib/sayError";
import { nameProblem, nameIdeas, takenSentence } from "@/shared/lib/names";

const SHORT_PASSWORD = "Use at least 6 characters for your password.";

/** What this phone kept for the person leaving that the next person mustn't
    see: today's daily grid (the share card's squares) isn't kept per person. */
function forgetThisPhone() {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith("bg-daily-grid-")) localStorage.removeItem(k);
    }
  } catch { /* private mode */ }
}

/** Every profile column a player may read (the grant in schema.sql, F48). */
const PROFILE_COLUMNS = "id, username, avatar, total_answered, total_correct, created_at, streak, best_streak, last_played, is_guest, best_round";

interface AuthValue {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  /** True when there is no backend at all — the app runs on local content only. */
  offline: boolean;
  signIn(id: string, password: string): Promise<{ error: string | null }>;
  /** `id` is a username, or an email for the accounts made before names. */
  signUp(id: string, password: string): Promise<{ error: string | null }>;
  signInWithLink(email: string): Promise<{ error: string | null }>;
  /** A name and nothing else. The wall in front of a nine-year-old or a
      grandparent was "and a password", so a guest gets neither an email nor
      one — just an anonymous session and the name they typed. */
  signInAsGuest(name: string): Promise<{ error: string | null }>;
  /** Turns that same account into a real one, keeping its id, so a guest who
      decides to stay does not lose the games they already played. */
  claimAccount(name: string, password: string): Promise<{ error: string | null }>;
  /** The name a guest just saved their account under, for the "Saved" card;
      null otherwise. Cleared by clearClaimed or signing out. */
  claimedAs: string | null;
  clearClaimed(): void;
  /** The live check a name field runs as you type: a sentence, or null when
      the name can be used. Your own current name always can. */
  checkName(name: string): Promise<string | null>;
  /** True while the session is anonymous. Guests are kept off the leaderboard. */
  isGuest: boolean;
  setPassword(password: string): Promise<{ error: string | null }>;
  /** Names are chosen, not generated — everything social shows one. */
  setUsername(name: string): Promise<{ error: string | null }>;
  signOut(): Promise<void>;
  refreshProfile(): Promise<void>;
  /** Drop in a profile row we already have — touch_streak returns one, and
      refetching it just to see the same numbers is a wasted round trip. */
  applyProfile(p: Profile): void;
}

const Ctx = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(isConfigured);
  const [claimedAs, setClaimedAs] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session: Session | null) => {
      setUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function refreshProfile() {
    if (!supabase || !user) { setProfile(null); return; }
    // Named columns, not "*": friend_code is readable by nobody over the API
    // (F48), so a "*" would be refused outright. PROFILE_COLUMNS matches the grant.
    const { data } = await supabase.from("profiles").select(PROFILE_COLUMNS).eq("id", user.id).single();
    setProfile((data as Profile | null) ?? null);
  }

  useEffect(() => { void refreshProfile(); /* eslint-disable-next-line */ }, [user?.id]);

  /**
   * Password is the primary method on purpose. Supabase's built-in mailer allows
   * roughly two messages an hour and is documented as test-only, so magic links
   * cannot be the only way in until custom SMTP exists.
   */
  /**
   * The one question every name form asks: can this name be used? A sentence
   * if not, null if so. The shape is checked here, so "Tobi!" isn't told it's
   * taken; a name that's only taken comes back with a free one beside it.
   * `mine` is the name you already have, which is never "taken" from you.
   */
  async function nameBlocked(name: string, mine?: string): Promise<string | null> {
    const problem = nameProblem(name);
    if (problem) return problem;
    const want = name.trim();
    if (mine && mine.toLowerCase() === want.toLowerCase()) return null;
    const { data: free, error } = await supabase!.rpc("username_available", { p_name: want });
    if (error) return sayError(error, "Couldn't check that name. Try again.");
    if (free !== false) return null;
    for (const idea of nameIdeas(want)) {
      const { data: ok } = await supabase!.rpc("username_available", { p_name: idea });
      if (ok === true) return takenSentence(idea);
    }
    return takenSentence(null);
  }

  async function signIn(id: string, password: string) {
    if (!supabase) return { error: NO_SERVER };
    if (!id.trim() || !password) return { error: "Type your name and your password." };
    const { error } = await supabase.auth.signInWithPassword({ email: asLogin(id), password });
    if (!error) return { error: null };
    return {
      error: /invalid login/i.test(error.message)
        ? "That name and password don't match an account."
        : sayError(error, "Couldn't sign you in. Try again."),
    };
  }

  async function signUp(id: string, password: string) {
    if (!supabase) return { error: NO_SERVER };
    const username = id.includes("@") ? undefined : id.trim();

    if (username !== undefined) {
      const blocked = await nameBlocked(username);
      if (blocked) return { error: blocked };
    }
    if (password.length < 6) return { error: SHORT_PASSWORD };

    const { error } = await supabase.auth.signUp({
      email: asLogin(id), password,
      // The trigger reads this, so the name you chose is the name you get
      // rather than one derived from the address we invented for you.
      options: { data: username ? { username } : undefined,
                 emailRedirectTo: window.location.origin },
    });
    if (!error) return { error: null };
    return {
      error: /already registered|already been/i.test(error.message)
        ? "That name is already taken."
        : sayError(error, "Couldn't make your account. Try again."),
    };
  }

  async function signInAsGuest(name: string) {
    if (!supabase) return { error: NO_SERVER };
    const username = name.trim();
    // Same check the real sign-up does. Without it the trigger silently falls
    // back to guest_ab12 and the player wonders who that is.
    const blocked = await nameBlocked(username);
    if (blocked) return { error: blocked };
    const { error } = await supabase.auth.signInAnonymously({
      options: { data: username ? { username } : undefined },
    });
    if (!error) return { error: null };
    // The one failure worth naming, because it is a project setting rather
    // than anything the player did.
    return {
      error: /anonymous/i.test(error.message)
        ? "Playing as a guest is switched off right now. Make an account instead."
        : sayError(error, "Couldn't start a guest game. Try again."),
    };
  }

  /**
   * Anonymous → permanent, on the same row, so the id survives and with it every
   * room, score and streak already attached to it. The trigger on auth.users
   * clears is_guest when is_anonymous flips.
   */
  async function claimAccount(name: string, password: string) {
    if (!supabase || !user) return { error: NO_SERVER };
    const username = name.trim();
    const blocked = await nameBlocked(username, profile?.username);
    if (blocked) return { error: blocked };
    if (password.length < 6) return { error: SHORT_PASSWORD };
    // The name first (F4, K). set_username is the race-safe step: the server
    // takes it or says it went, and nothing else has changed yet. Only then the
    // login, which is built from the name. The other way round, a name taken in
    // the moment between left a login of one name on a profile of another.
    const before = profile?.username ?? null;
    const named = await setUsername(username);
    if (named.error) return named;
    const { error } = await supabase.auth.updateUser({
      email: asLogin(username), password, data: { username },
    });
    if (error) {
      if (/already registered|already been/i.test(error.message)) {
        // An old account still signs in with this name. The name can't be your
        // login, so it doesn't stay your name either: put the old one back.
        if (before && before !== username) await supabase.rpc("set_username", { p_name: before });
        await refreshProfile();
        return { error: "That name is kept for an older account's sign-in. Pick another." };
      }
      // The name is yours now; only the password didn't save. Trying again
      // keeps the name (it's already yours) and sends the login again.
      return { error: sayError(error, "Your name is saved, but your password isn't. Try again.") };
    }
    // `is_anonymous` is a JWT claim, so `isGuest` keeps reading true until the
    // token is reissued. Refresh it now, or a freshly-claimed account still sees
    // the guest "claim your account" prompts until the next refresh.
    await supabase.auth.refreshSession();
    await refreshProfile();
    setClaimedAs(username);
    return { error: null };
  }

  /** Kept as a fallback. Will hit the rate limit until custom SMTP is set up. */
  async function signInWithLink(email: string) {
    if (!supabase) return { error: NO_SERVER };
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    return { error: error ? sayError(error, "Couldn't send the link. Try again.") : null };
  }

  /**
   * Accounts created by magic link have no password at all, so once password
   * became the primary method those users were locked out with no route back.
   * This is that route — chosen by them, never set on their behalf.
   */
  async function setPassword(password: string) {
    if (!supabase) return { error: NO_SERVER };
    const { error } = await supabase.auth.updateUser({ password });
    return { error: error ? sayError(error, "Couldn't save your password. Try again.") : null };
  }

  async function setUsername(name: string) {
    if (!supabase) return { error: NO_SERVER };
    const blocked = await nameBlocked(name, profile?.username);
    if (blocked) return { error: blocked };
    const { data, error } = await supabase.rpc("set_username", { p_name: name.trim() });
    if (error) return { error: sayError(error, "Couldn't save your name. Try again.") };
    // Both already checked above; these are the race where it changed between.
    if (data === "taken") return { error: takenSentence(null) };
    if (data === "invalid") return { error: nameProblem(name) ?? "Letters, numbers and _ only." };
    await refreshProfile();
    return { error: null };
  }

  /**
   * Sign-out always works, signal or not (F5, M). supabase-js asks the server
   * first and keeps the login if it can't reach it, so with no signal the
   * profile was cleared but the session stayed: a signed-in account with no
   * name. Now the phone forgets first: the stored login goes, and signOut then
   * has nothing to ask the server about, so it finishes offline and tells every
   * listener. The server hears about it in the background, with the token
   * held back for that, and simply never does if there's no signal; the old
   * refresh token then expires on its own.
   */
  async function signOut() {
    if (!supabase) return;
    const { data } = await supabase.auth.getSession();       // read from the phone, no network
    const token = data.session?.access_token ?? null;
    supabase.auth.stopAutoRefresh();
    await releasePush(token);                                 // bounded; the server part isn't waited for
    try { localStorage.removeItem(AUTH_STORAGE_KEY); } catch { /* private mode */ }
    forgetThisPhone();
    await supabase.auth.signOut({ scope: "local" });          // no session left: no network, just SIGNED_OUT
    if (token) {
      void fetch(`${SERVER.url}/auth/v1/logout?scope=local`, {
        method: "POST", keepalive: true,
        headers: { apikey: SERVER.key, Authorization: `Bearer ${token}` },
      }).catch(() => { /* offline: the refresh token expires on its own */ });
    }
    setUser(null);
    setProfile(null);
    setClaimedAs(null);
    supabase.auth.startAutoRefresh();
  }

  return (
    <Ctx.Provider value={{ user, profile, loading, offline: !isConfigured, isGuest: !!user?.is_anonymous,
      signIn, signUp, signInWithLink, signInAsGuest, claimAccount,
      claimedAs, clearClaimed: () => setClaimedAs(null),
      checkName: (name: string) => supabase ? nameBlocked(name, profile?.username) : Promise.resolve(nameProblem(name)),
      setPassword, setUsername, signOut, refreshProfile, applyProfile: setProfile }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside AuthProvider");
  return v;
}
