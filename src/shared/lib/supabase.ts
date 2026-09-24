import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/**
 * Where the login is kept on this phone. The same name supabase-js picks by
 * default (so nobody already signed in is signed out by this line), written
 * down because sign-out has to be able to forget it without the network (F5).
 */
export const AUTH_STORAGE_KEY = url ? `sb-${new URL(url).hostname.split(".")[0]}-auth-token` : "";

/**
 * Deliberately NOT parameterised with a hand-written Database type. Hand-written
 * generics look like type safety while being unverified against the real schema —
 * which is worse than none. Rows are cast explicitly at each call site instead.
 * Replace this with `supabase gen types typescript` output once the CLI is set up.
 */
export const supabase: SupabaseClient | null =
  url && key ? createClient(url, key, { auth: { storageKey: AUTH_STORAGE_KEY } }) : null;

export const isConfigured = Boolean(url && key);

/** For the few calls that must go out after the client has forgotten the login. */
export const SERVER = { url: url ?? "", key: key ?? "" };
