import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/**
 * Deliberately NOT parameterised with a hand-written Database type. Hand-written
 * generics look like type safety while being unverified against the real schema —
 * which is worse than none. Rows are cast explicitly at each call site instead.
 * Replace this with `supabase gen types typescript` output once the CLI is set up.
 */
export const supabase: SupabaseClient | null =
  url && key ? createClient(url, key) : null;

export const isConfigured = Boolean(url && key);
