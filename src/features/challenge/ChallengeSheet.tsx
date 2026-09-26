import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { Sunflower } from "@/shared/brand/Sunflower";
import { SPRING } from "@/shared/ui/motion";
import { startShot, loadMatter, SHOT_HOW, type ShotControl, type ShotKind, type ShotLevel, type ShotRec, type ShotResult } from "./shots";

/**
 * The challenge sheet (drawings 26a–26f, "Play It With" drawings): tap a spot and this
 * slides up over the board, full height. At the top, a mini board with the spot
 * you're playing for; the challenge gets the rest of the phone. The result
 * lands on the sheet for a beat (26e, 26f), then it goes by itself.
 */
export function ChallengeSheet({ title, sub, mini, children }: {
  /** "For the middle square" */
  title: string; sub?: string; mini: ReactNode; children: ReactNode;
}) {
  return (
    <motion.div role="dialog" aria-modal="true" aria-label={title}
      initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={SPRING}
      className="card fixed inset-x-0 bottom-0 top-[calc(34px+env(safe-area-inset-top))] z-40 rounded-t-[26px] rounded-b-none
        bg-board text-ink px-4 pt-3.5 pb-[calc(16px+env(safe-area-inset-bottom))] grid grid-rows-[auto_auto_1fr] gap-2.5
        shadow-[0_-10px_30px_rgba(14,74,176,.25)] max-w-3xl mx-auto">
      <div className="w-10 h-[5px] rounded-full bg-hair mx-auto" />
      <div className="flex items-center gap-2.5 min-w-0">
        {mini}
        <div className="min-w-0 flex-1">
          <b className="block font-display font-normal text-[18px] leading-[1.1]">{title}</b>
          {sub && <span className="block text-[14px] font-semibold text-soft">{sub}</span>}
        </div>
      </div>
      <div className="min-h-0 grid">{children}</div>
    </motion.div>
  );
}

/** The spot, small: a 3x3 (Tic Tac Toe) or 7x6 (Connect 4) with it marked. */
export function MiniBoard({ board, target, won = false }: {
  board: (("x" | "o") | null)[]; target: number | null; won?: boolean;
}) {
  if (board.length === 9) {
    return (
      <div aria-hidden className="grid grid-cols-3 gap-[3px] p-[5px] bg-board rounded-[9px] shadow-[inset_0_0_0_2px_var(--color-hair)] shrink-0">
        {board.map((c, i) => {
          const at = i === target;
          return <i key={i} className={`block w-3.5 h-3.5 rounded-[4px] ${
            at ? (won ? "bg-petal shadow-[inset_0_0_0_2px_var(--color-ink-day)]" : "bg-board shadow-[inset_0_0_0_2px_var(--color-ink-day)]")
              : c === "x" ? "bg-petal-hi" : c === "o" ? "bg-sky-hi" : "bg-mist"}`} />;
        })}
      </div>
    );
  }
  // Connect 4: the column in play ringed, the discs already down
  return (
    <div aria-hidden className="grid grid-cols-7 gap-[2px] p-1 rounded-[8px] bg-linear-to-b from-sky to-sky-lo shrink-0">
      {board.map((c, i) => {
        const col = i % 7;
        return <i key={i} className={`block w-[9px] h-[9px] rounded-full ${
          c === "x" ? "bg-petal" : c === "o" ? "bg-sky-hi" : col === target ? "bg-board/85" : "bg-ink-day/45"}`} />;
      })}
    </div>
  );
}

/**
 * A shot on the sheet. The canvas takes the space; when the throw settles the
 * result shows over it with the flower (26e blooms, 26f is bored) and the sheet
 * reports back after a beat, or at once from the button.
 *
 * In a room the other phone uses the same panel to watch (26h, 26i): the same
 * scene from the shared `seed`, no hands on it, and the thrower's `flight`
 * played back when it arrives.
 */
export function ShotPanel({ kind, level, onDone, onWind, seed, tint, watch = false, flight = null, onSettle, onFly, locked = false, outcome = null }: {
  kind: ShotKind; level: ShotLevel;
  onDone: (hit: boolean) => void;
  onWind?: (w: number) => void;
  seed?: number;
  tint?: "petal" | "sky";
  watch?: boolean;
  /** the thrower's flight, for the phone that's watching */
  flight?: ShotRec | null;
  /** the moment the shot settles, before the result's beat (a room writes it then) */
  onSettle?: (r: ShotResult) => void;
  /** the moment the ball leaves the hand */
  onFly?: () => void;
  /** out of time: no new throw, though one in the air still lands */
  locked?: boolean;
  /** a result from outside the throw (the clock ran out): shown, not written */
  outcome?: ShotResult | null;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const ctl = useRef<ShotControl | null>(null);
  const [result, setResult] = useState<ShotResult | null>(null);
  const [hint, setHint] = useState("");
  const [ready, setReady] = useState(kind !== "knock");
  const [ran, setRan] = useState<ShotKind | null>(kind === "knock" ? null : kind);
  const told = useRef(false);
  // The game calls back long after this render: always reach the latest props.
  const cb = useRef({ onDone, onSettle, onFly, onWind });
  cb.current = { onDone, onSettle, onFly, onWind };
  const finish = (hit: boolean) => { if (told.current) return; told.current = true; cb.current.onDone(hit); };
  const settle = (r: ShotResult) => {
    setResult(r); cb.current.onSettle?.(r);
    setTimeout(() => finish(r.hit), r.hit ? 1700 : 1900);
  };

  useEffect(() => {
    let gone = false;
    const run = (k: ShotKind, matter?: unknown) => {
      if (gone || !canvas.current) return;
      setRan(k); setReady(true);
      ctl.current = startShot(k, canvas.current, {
        level, seed, tint, watch,
        onWind: (w) => cb.current.onWind?.(w), onFly: () => cb.current.onFly?.(),
        onResult: settle,
      }, (h) => { setHint(h); setTimeout(() => setHint(""), 1400); }, matter);
    };
    if (kind === "knock") {
      // Knock-down's physics loads on first use. If it can't, the turn is a cup
      // toss rather than a spot nobody can play for.
      loadMatter().then((M) => run("knock", M)).catch(() => run("cup"));
    } else run(kind);
    return () => { gone = true; ctl.current?.stop(); ctl.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, level, seed, watch]);

  useEffect(() => {
    if (!outcome || result) return;
    setResult(outcome); setTimeout(() => finish(outcome.hit), 1900);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outcome]);

  // The watcher plays the flight once it's here and the scene is up. A flight
  // of another game (this phone fell back to cup toss) can't be drawn: its
  // result still lands.
  useEffect(() => {
    if (!watch || !flight || !ran || result) return;
    if (flight.kind !== ran) { settle({ hit: flight.hit, big: flight.big, small: flight.small }); return; }
    ctl.current?.replay(flight);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watch, flight, ran]);

  return (
    <div className="relative min-h-0 rounded-[18px] overflow-hidden bg-mist">
      <canvas ref={canvas} className="block w-full h-full touch-none" aria-label={SHOT_HOW[ran ?? kind]} />
      {!ready && <p className="absolute inset-0 grid place-items-center text-[14px] font-bold text-soft">Setting up…</p>}
      {locked && !result && <div className="absolute inset-0" aria-hidden />}
      {hint && !result && (
        <p className="absolute left-0 right-0 top-4 text-center font-display text-[22px] pointer-events-none">{hint}</p>
      )}
      {result && (
        <motion.div initial={{ opacity: 0, scale: .9 }} animate={{ opacity: 1, scale: 1 }} transition={SPRING}
          className="absolute inset-0 grid content-center justify-items-center gap-2 bg-board/70 text-center px-4" role="status">
          <Sunflower state={result.hit ? "bloom" : "bored"} stem={false} size={110} />
          <b className="font-display font-normal text-[40px] leading-none">{result.big}</b>
          {result.small && <span className="text-[14px] font-bold text-soft">{result.small}</span>}
          <button onClick={() => finish(result.hit)}
            className={`cut tap mt-2 min-h-[52px] px-6 font-display text-[19px] ${result.hit ? "cut-petal" : "cut-board"}`}>
            Back to the board
          </button>
        </motion.div>
      )}
    </div>
  );
}
