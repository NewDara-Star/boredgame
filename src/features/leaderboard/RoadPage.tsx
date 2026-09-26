import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/app/providers/AuthProvider";
import { supabase } from "@/shared/lib/supabase";
import { useProgress } from "@/features/play/useProgress";
import { rankFor, RANKS } from "@/features/play/rank";
import { rankStory } from "@/shared/card/moments";
import { ShareButtons } from "@/shared/card/ShareButtons";
import type { MatchCard } from "@/shared/card/frame";
import { useFocusMode } from "@/app/layout/focus";
import { BackDisc } from "@/app/layout/ScreenTitle";
import { riseIn } from "@/shared/ui/motion";
import { SunRoad, type OnRoad } from "./SunRoad";

/**
 * The road to the sun (#48), opened from the ladder on You. The whole phone
 * is the picture (no tab bar): back and "Rank 5 of 10" at the top, the climb
 * behind, and one card at the foot with your rank, Play to grow and Share.
 */
export function RoadPage() {
  const { user } = useAuth();
  const p = useProgress();
  const { current, next } = rankFor(p.answered);
  const idx = RANKS.findIndex((r) => r.key === current.key);
  const friends = useFriendsOnRoad(user?.id);
  useFocusMode(true);
  const [card, setCard] = useState<MatchCard | null>(null);
  useEffect(() => {
    let cancelled = false;
    void rankStory(current).then((m) => { if (!cancelled) setCard(m); }).catch(() => {});
    return () => { cancelled = true; };
  }, [current]);

  return (
    <div className="flex flex-col gap-[11px] min-h-[calc(100dvh-20px-env(safe-area-inset-top)-env(safe-area-inset-bottom))]">
      <div className="fixed inset-0 z-0 overflow-hidden"><SunRoad answered={p.answered} friends={friends} /></div>
      <div className="relative z-10 flex items-center justify-between gap-2.5 min-h-10">
        <BackDisc to="/you" label="Back to You" />
        <span className="chip bg-board text-ink rounded-full px-[11px] py-[5px] text-[13px] font-bold">Rank {idx + 1} of {RANKS.length}</span>
      </div>
      <div className="flex-1" />
      <motion.section variants={riseIn} initial="hidden" animate="show"
        className="relative z-10 card shadow-lift-sm rounded-[20px] p-3.5 grid gap-2.5 text-ink">
        <div>
          <h1 className="font-display text-[22px] leading-[1.15]">{current.name}</h1>
          <small className="block text-[14px] font-semibold text-soft tabular-nums">
            {p.answered.toLocaleString()} answered{next ? `, ${(next.min - p.answered).toLocaleString()} to ${next.name}` : ". Top of the road."}
          </small>
        </div>
        <div className="grid grid-cols-[1.35fr_1fr] gap-[9px]">
          <Link to="/trivia" className="cut tap cut-petal min-h-[52px] grid place-items-center font-display text-[19px]">Play to grow</Link>
          <ShareButtons card={card} story={false} tone="sky" className="contents" />
        </div>
      </motion.section>
    </div>
  );
}

/** Your friends and how far they've climbed. Names and totals only. */
function useFriendsOnRoad(userId?: string): OnRoad[] {
  const [list, setList] = useState<OnRoad[]>([]);
  useEffect(() => {
    if (!supabase || !userId) { setList([]); return; }
    let gone = false;
    void supabase.from("friendships")
      .select("friend:profiles!friend_id(id, username, total_answered)")
      .eq("user_id", userId)
      .then(({ data }) => {
        if (gone) return;
        // PostgREST types a to-one embed as an array; it is really 0-or-1 rows.
        const rows = ((data ?? []) as unknown as { friend: { id: string; username: string; total_answered: number } | null }[])
          .map((r) => r.friend).filter((f): f is { id: string; username: string; total_answered: number } => !!f);
        setList(rows.map((f) => ({ id: f.id, name: f.username, answered: f.total_answered ?? 0 })));
      });
    return () => { gone = true; };
  }, [userId]);
  return list;
}
