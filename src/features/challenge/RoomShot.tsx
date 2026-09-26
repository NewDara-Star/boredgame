import { useEffect, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Sunflower } from "@/shared/brand/Sunflower";
import { ChallengeSheet, MiniBoard, ShotPanel } from "./ChallengeSheet";
import { SHOT_HOW, type ShotKind, type ShotLevel, type ShotRec, type ShotResult } from "./shots";
import { SHOT_MS } from "./kinds";

type Mark = "x" | "o";
type Flight = ShotRec & { seed: number; by: Mark };

/** What one turn's sheet is about, fixed when it opens: the row moves on
    underneath (the answer lands, the board changes) while the sheet finishes. */
interface Turn {
  seed: number; kind: ShotKind; level: ShotLevel; mine: boolean; by: Mark;
  board: (Mark | null)[]; target: number | null;
}

const windWords = (w: number) => (w === 0 ? "no wind" : `wind ${w > 0 ? "→" : "←"} ${Math.abs(w).toFixed(1)}`);
const clockText = (ms: number) => `0:${String(Math.max(0, Math.ceil(ms / 1000))).padStart(2, "0")}`;

/**
 * A shot in a room (Play It With drawings 26g–26i). The thrower gets the solo
 * sheet plus a 30-second bar; the other phone opens the same sheet on the same
 * scene (seeded from the turn both phones share), can't touch it, and plays the
 * throw back from the flight the thrower's phone writes. When time runs out
 * with no throw, both sheets say so and the spot stays open.
 */
export function RoomShot({
  active, kind, seed, level, by, myMark, names, board, target, spot, askedAt, now, flight,
  onSettle, onFly,
}: {
  /** a shot is owed right now */
  active: boolean;
  kind: ShotKind; seed: number; level: ShotLevel;
  /** who's throwing */
  by: Mark;
  myMark: Mark | null;
  names: Record<Mark, string>;
  board: (Mark | null)[]; target: number | null;
  /** "the middle square", "the far-left column" */
  spot: (target: number | null) => string;
  /** when the shot was owed, on this phone's clock, and the time now */
  askedAt: number; now: number;
  /** the latest flight in the room */
  flight: Flight | null;
  /** the thrower's result and flight, the moment it settles */
  onSettle: (hit: boolean, rec?: ShotRec) => void;
  /** the ball has left the hand (no one may time it out now) */
  onFly: (flying: boolean) => void;
}) {
  const [turn, setTurn] = useState<Turn | null>(null);
  const shut = useRef<number | null>(null);          // the last turn closed here
  const [wind, setWind] = useState<number | null>(null);
  const [thrown, setThrown] = useState(false);
  const [settled, setSettled] = useState(false);
  const [outcome, setOutcome] = useState<ShotResult | null>(null);

  // Open on a new shot. Keyed on the seed, which is the turn itself.
  useEffect(() => {
    if (!active || turn?.seed === seed || shut.current === seed) return;
    setTurn({ seed, kind, level, mine: by === myMark, by, board, target });
    setWind(null); setThrown(false); setSettled(false); setOutcome(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, seed]);

  const theirs = turn && flight && flight.seed === turn.seed && !turn.mine ? flight : null;
  const left = SHOT_MS - (now - askedAt);

  // The turn moved on with no throw from this sheet: out of time.
  useEffect(() => {
    if (!turn || active || outcome || settled) return;
    if (turn.mine ? thrown : theirs) return;
    setOutcome({ hit: false, big: "Out of time",
      small: turn.mine ? "The spot stays open" : `${names[turn.by]} didn't throw. The spot stays open.` });
  }, [turn, active, outcome, settled, thrown, theirs, names]);

  const close = () => { if (turn) shut.current = turn.seed; setTurn(null); onFly(false); };

  const name = turn ? names[turn.by] : "";
  const where = turn ? spot(turn.target) : "";
  const easy = turn?.level === "easy";
  const extras = [turn?.kind === "cup" && wind !== null ? windWords(wind) : null, easy ? "Easy" : null].filter(Boolean);
  const sub = !turn ? "" : turn.mine
    ? [SHOT_HOW[turn.kind], ...extras].join(" · ")
    : theirs ? "Here it comes" : ["Lining it up", ...extras].join(" · ");
  const flying = turn?.mine ? thrown : !!theirs;

  return (
    <AnimatePresence>
      {turn && (
        <ChallengeSheet key={`room-shot-${turn.seed}`}
          title={turn.mine ? `For ${where}` : `${name}'s going for ${where}`} sub={sub}
          mini={<MiniBoard board={turn.board} target={turn.target} />}>
          <div className={`min-h-0 grid gap-2.5 ${turn.mine ? "grid-rows-[auto_1fr]" : "grid-rows-[auto_1fr_auto]"}`}>
            <div className="flex items-center gap-2" role="timer"
              aria-label={flying || settled ? "Thrown" : `${Math.max(0, Math.ceil(left / 1000))} seconds left`}>
              <div className="h-2 flex-1 rounded-full bg-mist overflow-hidden">
                <i className={`block h-full rounded-full ${turn.mine ? "bg-petal" : "bg-sky"}`}
                  style={{ width: `${flying || settled || outcome ? 0 : Math.max(0, Math.min(1, left / SHOT_MS)) * 100}%` }} />
              </div>
              <b className="font-mono text-[14px] tabular-nums min-w-[3.2em] text-right">
                {flying || settled ? "Thrown" : clockText(left)}
              </b>
            </div>
            <ShotPanel kind={turn.kind} level={turn.level} seed={turn.seed}
              tint={turn.by === "x" ? "petal" : "sky"}
              watch={!turn.mine} flight={theirs} outcome={outcome}
              locked={turn.mine && (left <= 0 || !active)}
              onWind={setWind}
              onFly={() => { setThrown(true); onFly(true); }}
              onSettle={(r) => { setSettled(true); if (turn.mine) { onSettle(r.hit, r.rec); onFly(false); } }}
              onDone={close} />
            {!turn.mine && (
              <div className="flex items-center justify-center gap-2">
                <Sunflower state={theirs ? "awake" : "look-right"} stem={false} size={30} />
                <span className="text-[14px] font-extrabold text-soft">Watching {name}</span>
              </div>
            )}
          </div>
        </ChallengeSheet>
      )}
    </AnimatePresence>
  );
}
