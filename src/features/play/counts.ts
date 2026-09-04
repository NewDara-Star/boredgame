import { useEffect, useState } from "react";
import { supabase } from "@/shared/lib/supabase";
import { PICTO_SEED } from "@/shared/data/picto";
import { TRIVIA_SEED } from "@/shared/data/trivia";

/**
 * Live counts, not bundled ones. The seed files are the offline fallback and
 * stopped matching the database the moment anything was authored — the home
 * page was advertising 51 questions over a bank of 220.
 */
export function useCounts() {
  const [counts, setCounts] = useState({ picto: PICTO_SEED.length, trivia: TRIVIA_SEED.length });

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    (async () => {
      const [p, t] = await Promise.all([
        supabase.from("puzzles").select("id", { count: "exact", head: true })
          .eq("game", "picto").eq("status", "live"),
        supabase.from("puzzles").select("id", { count: "exact", head: true })
          .eq("game", "trivia").eq("status", "live"),
      ]);
      if (cancelled) return;
      setCounts({
        picto: p.count ?? PICTO_SEED.length,
        trivia: t.count ?? TRIVIA_SEED.length,
      });
    })();
    return () => { cancelled = true; };
  }, []);

  return counts;
}
