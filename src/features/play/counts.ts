import { useEffect, useState } from "react";
import { supabase } from "@/shared/lib/supabase";

/**
 * Is there anything live to play in each bank? Only the "nothing live yet"
 * guard needs it (F23): the counts it used to fetch on every visit showed as
 * "104 in the bank", which the new tiles don't show. One row each, asked once
 * per visit; with no server, the bundled questions are there, so yes.
 */
type Live = { picto: boolean; trivia: boolean };
let asked: Promise<Live> | null = null;

function ask(): Promise<Live> {
  if (!supabase) return Promise.resolve({ picto: true, trivia: true });
  asked ??= (async () => {
    const one = (game: string) => supabase!.from("puzzles").select("id").eq("game", game).eq("status", "live").limit(1);
    const [p, t] = await Promise.all([one("picto"), one("trivia")]);
    // A failed check never hides a game: an error reads as "there is something".
    return { picto: !!p.error || (p.data?.length ?? 0) > 0, trivia: !!t.error || (t.data?.length ?? 0) > 0 };
  })();
  return asked;
}

export function useLiveBanks(): Live {
  const [live, setLive] = useState<Live>({ picto: true, trivia: true });
  useEffect(() => {
    let gone = false;
    void ask().then((l) => { if (!gone) setLive(l); });
    return () => { gone = true; };
  }, []);
  return live;
}
