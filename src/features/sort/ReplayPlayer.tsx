import { useEffect, useRef, useState, type ReactNode } from "react";
import { fontsReady, shareResult, SIZE, toCard } from "@/shared/card/frame";
import { linkTo } from "@/shared/card/voice";
import { encodeGif } from "@/shared/card/gif";
import { durationOf, paintFrame, type Replay } from "./replay";

/** the film's size and rate as a file: 540², 12.5 fps (an exact 8cs GIF delay) */
const GIF_SIZE = 540, GIF_FPS = 12.5;

/**
 * The solve, watched back, on a canvas the size of the card. Plays once and
 * holds; tap to play again. "Save the film" encodes the same frames to a
 * GIF — every chat app plays one, and no browser gets a say in it.
 */
export function ReplayPlayer({ replay, autoplay = true, premake = false, children }:
  { replay: Replay; autoplay?: boolean;
    /** make the GIF as soon as the film has played once, so Share the film
        shares on the first tap (#32): the share sheet needs the tap that asks
        for it, and making the film takes longer than a tap lasts */
    premake?: boolean;
    /** a second button beside the film's own */ children?: ReactNode }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [playing, setPlaying] = useState(false);
  const [busy, setBusy] = useState<{ done: number; total: number } | null>(null);
  const [gif, setGif] = useState<{ url: string; file: File; bytes: number } | null>(null);
  const runId = useRef(0);
  const [ended, setEnded] = useState(false);
  const making = useRef(false);

  // any new replay throws the old film away
  useEffect(() => { setGif(null); setEnded(false); }, [replay]);

  const play = () => {
    const el = canvas.current; if (!el) return;
    const c = el.getContext("2d"); if (!c) return;
    const id = ++runId.current;
    const total = durationOf(replay);
    setPlaying(true);
    void fontsReady().then(() => {
      const t0 = performance.now();
      const tick = () => {
        if (runId.current !== id) return;
        const t = Math.min(total, performance.now() - t0);
        paintFrame(c, replay, t);
        if (t < total) requestAnimationFrame(tick); else { setPlaying(false); setEnded(true); }
      };
      requestAnimationFrame(tick);
    });
  };
  useEffect(() => {
    if (autoplay) play(); else { const c = canvas.current?.getContext("2d"); if (c) void fontsReady().then(() => paintFrame(c, replay, durationOf(replay))); }
    return () => { runId.current++; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replay]);

  const send = (file: File) => void shareResult({ file, url: linkTo("/ballsort"),
    text: `My Ball Sort solve: ${replay.moves} moves, par ${replay.par}. Beat it:` });
  const save = async () => {
    if (gif) { send(gif.file); return; }
    if (making.current) return;
    making.current = true;
    await fontsReady();
    const big = document.createElement("canvas"); big.width = SIZE; big.height = SIZE;
    const small = document.createElement("canvas"); small.width = GIF_SIZE; small.height = GIF_SIZE;
    const bc = big.getContext("2d")!, sc = small.getContext("2d")!;
    const total = durationOf(replay);
    const step = 1000 / GIF_FPS;
    const count = Math.ceil(total / step) + 1;
    setBusy({ done: 0, total: count });
    const blob = await encodeGif({
      width: GIF_SIZE, height: GIF_SIZE, fps: GIF_FPS,
      frame: (i) => {
        if (i >= count) return null;
        paintFrame(bc, replay, Math.min(total, i * step));
        sc.drawImage(big, 0, 0, GIF_SIZE, GIF_SIZE);
        return sc.getImageData(0, 0, GIF_SIZE, GIF_SIZE);
      },
      onProgress: (done) => setBusy({ done, total: count }),
    });
    const card = await toCard(small, "BALL SORT", null, "gif", blob);
    setBusy(null);
    making.current = false;
    setGif({ url: card.url, file: card.file, bytes: blob.size });
    // the share sheet needs the tap that asked for it; this one is a
    // second tap away, so say so rather than open nothing
  };

  useEffect(() => {
    if (premake && ended && !gif) void save();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [premake, ended, gif]);

  const CUT = "cut tap cut-petal min-h-[52px] px-3 font-display text-[19px] leading-tight";
  const filmButton = busy ? (
    <div className={`${CUT} grid content-center gap-1`} role="status">
      <span className="text-[15px]">Making the film…</span>
      <span className="block h-2 w-full rounded-full bg-board/70 overflow-hidden">
        <span className="block h-full bg-ink-day transition-[width]" style={{ width: `${(100 * busy.done) / busy.total}%` }} />
      </span>
    </div>
  ) : gif ? (
    <button onClick={() => send(gif.file)} className={CUT}>
      Share the film
      <span className="block text-[12px] font-bold font-sans">{(gif.bytes / 1_000_000).toFixed(1)} MB GIF</span>
    </button>
  ) : (
    <button onClick={() => void save()} className={CUT}>
      {premake ? "Share the film" : "Make the film"}
    </button>
  );

  return (
    <div className="grid gap-[11px]">
      {/* .card.result: the film edge to edge, no frame of its own */}
      <button onClick={play} disabled={playing} aria-label="Play the replay"
        className="block w-full rounded-[20px] shadow-lift overflow-hidden bg-petal">
        <canvas ref={canvas} width={SIZE} height={SIZE} className="block w-full h-auto" />
      </button>
      <div className={`grid gap-[9px] ${children ? "grid-cols-[1.35fr_1fr]" : ""}`}>
        {filmButton}
        {children}
      </div>
    </div>
  );
}
