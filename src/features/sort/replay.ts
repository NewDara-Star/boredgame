/** One frame of the film onto a 1080² context: the card frame, the tubes at
    that moment, the run clock as the headline. Pure logic lives in rules.ts. */
import { paintCard, type Ctx } from "@/shared/card/frame";
import { drawTubes } from "./card";
import { clock, durationOf, frameAt, type Replay } from "./rules";

export { durationOf };
export type { Replay };

export function paintFrame(c: Ctx, r: Replay, t: number) {
  const f = frameAt(r, t);
  const overPar = r.moves - r.par;
  paintCard(c, {
    title: "BALL SORT", code: null, where: r.where,
    headline: clock(f.runMs),
    hero: (cc, box) => drawTubes(cc, box, f.tubes, r.cap, f.flight),
    caption: f.done
      ? `${r.rank ? `#${r.rank} today · ` : ""}${r.moves} moves${overPar <= 0 ? ", par" : `, par ${r.par}`} · ${r.level}`
      : `${r.name} · ${r.level}`,
  });
}
