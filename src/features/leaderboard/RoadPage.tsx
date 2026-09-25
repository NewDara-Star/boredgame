import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/app/providers/AuthProvider";
import { supabase } from "@/shared/lib/supabase";
import { useProgress } from "@/features/play/useProgress";
import { rankFor, RANKS } from "@/features/play/rank";
import { stagger, riseIn } from "@/shared/ui/motion";
import { SunRoad, type OnRoad } from "./SunRoad";
import { BackToYou } from "./LeaderboardPage";

/**
 * The road to the sun (#48): the whole climb in one picture, opened from the
 * ladder on You. Ranks you've passed in colour, yours big with the ring, the
 * rest grey, Legend as the sun, and your friends standing at their ranks.
 */
export function RoadPage() {
  const { user } = useAuth();
  const p = useProgress();
  const { current, next } = rankFor(p.answered);
  const idx = RANKS.findIndex((r) => r.key === current.key);
  const friends = useFriendsOnRoad(user?.id);

  return (
    <motion.div variants={stagger(0.07)} initial="hidden" animate="show" className="pb-6">
      <motion.div variants={riseIn}><BackToYou /></motion.div>
      <motion.p variants={riseIn} className="text-[12px] font-black text-soft mt-2">Rank {idx + 1} of {RANKS.length}</motion.p>
      <motion.h1 variants={riseIn} className="font-display text-[34px] leading-none font-semibold mt-1">{current.name}</motion.h1>
      <motion.p variants={riseIn} className="text-sm font-bold mt-2 tabular-nums">
        {p.answered.toLocaleString()} answered{next ? `, ${next.min - p.answered} to ${next.name}` : ". Top of the road."}
      </motion.p>
      <motion.div variants={riseIn}><SunRoad answered={p.answered} friends={friends} /></motion.div>
    </motion.div>
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
