import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { RankBadge } from "@/features/play/RankBadge";
import { rankFor, RANKS } from "@/features/play/rank";
import { rankStory } from "@/shared/card/moments";
import { ShareButtons } from "@/shared/card/ShareButtons";
import type { MatchCard } from "@/shared/card/frame";

/** Where each rank stands on the road, in % of the scene: Novice at the foot of
    the hill, Legend up by the sun. */
const AT: [number, number][] = [
  [16, 90], [40, 85], [66, 80], [80, 69], [58, 61], [32, 54], [22, 42], [44, 33], [68, 25], [82, 11],
];

/** Catmull-Rom through the stops, so the road bends instead of zigzagging. */
function road(pts: [number, number][]) {
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const [p0, p1, p2, p3] = [pts[i - 1] ?? pts[i], pts[i], pts[i + 1], pts[i + 2] ?? pts[i + 1]];
    d += ` C${p1[0] + (p2[0] - p0[0]) / 6} ${p1[1] + (p2[1] - p0[1]) / 6} ${p2[0] - (p3[0] - p1[0]) / 6} ${p2[1] - (p3[1] - p1[1]) / 6} ${p2[0]} ${p2[1]}`;
  }
  return d;
}
const ROAD = road([[8, 104], ...AT]);

/**
 * The ranks as a road up a hill toward the sun. Passed ranks stand in full
 * colour, yours is big with a ring showing how far to the next, the ones ahead
 * are grey, and Legend is at the top by the sun.
 */
export function SunRoad({ answered }: { answered: number }) {
  const { current, next, progress } = rankFor(answered);
  const idx = RANKS.findIndex((r) => r.key === current.key);
  const [card, setCard] = useState<MatchCard | null>(null);
  useEffect(() => {
    let cancelled = false;
    void rankStory(current).then((m) => { if (!cancelled) setCard(m); }).catch(() => {});
    return () => { cancelled = true; };
  }, [current]);

  const ring = 2 * Math.PI * 46;
  return (
    <div className="mt-5">
      <div className="relative w-full max-w-[440px] mx-auto aspect-[4/5]">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden className="absolute inset-0 w-full h-full">
          <circle cx="82" cy="11" r="11" className="fill-petal-hi" />
          <circle cx="82" cy="11" r="8" className="fill-petal" />
          <ellipse cx="50" cy="112" rx="78" ry="62" className="fill-leaf" />
          <ellipse cx="50" cy="114" rx="70" ry="54" className="fill-leaf-hi" opacity=".45" />
          <path d={ROAD} fill="none" className="stroke-ink" strokeLinecap="round" vectorEffect="non-scaling-stroke" style={{ strokeWidth: 26 }} />
          <path d={ROAD} fill="none" className="stroke-board" strokeLinecap="round" vectorEffect="non-scaling-stroke" style={{ strokeWidth: 18 }} />
          <path d={ROAD} fill="none" className="stroke-mist" strokeLinecap="round" strokeDasharray="2 3" vectorEffect="non-scaling-stroke" style={{ strokeWidth: 3 }} />
        </svg>
        {RANKS.map((r, i) => {
          const [x, y] = AT[i];
          const mine = i === idx;
          return (
            <div key={r.key} className="absolute -translate-x-1/2 -translate-y-1/2 grid justify-items-center"
              style={{ left: `${x}%`, top: `${y}%`, zIndex: mine ? 2 : 1 }}>
              {mine ? (
                <div className="relative grid place-items-center w-[96px] h-[96px]">
                  <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90" aria-hidden>
                    <circle cx="50" cy="50" r="46" className="fill-board stroke-mist" strokeWidth="7" />
                    <circle cx="50" cy="50" r="46" fill="none" className="stroke-petal" strokeWidth="7"
                      strokeLinecap="round" strokeDasharray={`${ring * progress} ${ring}`} />
                  </svg>
                  <RankBadge rank={r.key} size={62} className="relative" />
                </div>
              ) : (
                <RankBadge rank={r.key} size={i === 9 ? 44 : 34} locked={i > idx} />
              )}
              {(mine || i === 9) && (
                <span className="chip mt-1 bg-board text-ink text-[12px] font-bold whitespace-nowrap">{r.name}</span>
              )}
            </div>
          );
        })}
      </div>

      <div className="card mt-3 p-4 grid gap-3">
        <div>
          <p className="font-display text-2xl leading-tight">You're {current.name}</p>
          <p className="text-sm text-soft font-semibold">
            {next ? `${next.min - answered} more questions to ${next.name}` : "Top of the road. Nobody's past you."}
          </p>
        </div>
        <div className="grid grid-cols-[1.3fr_1fr] gap-2.5">
          <ShareButtons card={card} story={false} />
          <Link to="/trivia" className="cut tap cut-sky py-3.5 text-center font-display text-lg">Play a round</Link>
        </div>
      </div>
    </div>
  );
}
