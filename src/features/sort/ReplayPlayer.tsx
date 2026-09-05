import { useEffect, useRef, useState, type ReactNode } from "react";
import { fontsReady, saveCard, SIZE, toCard } from "@/shared/card/frame";
import { encodeGif } from "@/shared/card/gif";
import { durationOf, paintFrame, type Replay } from "./replay";

/** the film's size and rate as a file: 540², 12.5 fps (an exact 8cs GIF delay) */
const GIF_SIZE = 540, GIF_FPS = 12.5;

/**
 * The solve, watched back, on a canvas the size of the card. Plays once and
 * holds; tap to play again. "Save the film" encodes the same frames to a
 * GIF — every chat app plays one, and no browser gets a say in it.
 */
export function ReplayPlayer({ replay, autoplay = true, children }:
  { replay: Replay; autoplay?: boolean; /** a second button beside the film's own */ children?: ReactNode }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [playing, setPlaying] = useState(false);
  const [busy, setBusy] = useState<{ done: number; total: number } | null>(null);
  const [gif, setGif] = useState<{ url: string; file: File; bytes: number } | null>(null);
  const runId = useRef(0);

  // any new replay throws the old film away
  useEffect(() => { setGif(null); }, [replay]);

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
        if (t < total) requestAnimationFrame(tick); else setPlaying(false);
      };
      requestAnimationFrame(tick);
    });
  };
  useEffect(() => {
    if (autoplay) play(); else { const c = canvas.current?.getContext("2d"); if (c) void fontsReady().then(() => paintFrame(c, replay, durationOf(replay))); }
    return () => { runId.current++; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replay]);

  const save = async () => {
    if (gif) { saveCard(gif.file); return; }
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
    setGif({ url: card.url, file: card.file, bytes: blob.size });
    // the share sheet needs the tap that asked for it; this one is a
    // second tap away, so say so rather than open nothing
  };

  const filmButton = busy ? (
    <div className="piece bg-surface px-3 py-2.5 grid content-center">
      <p className="text-[12px] font-black uppercase tracking-widest text-soft">Making it…</p>
      <div className="mt-1.5 h-2.5 rounded-full border-2 border-ink bg-sand overflow-hidden">
        <div className="h-full bg-pop transition-[width]" style={{ width: `${(100 * busy.done) / busy.total}%` }} />
      </div>
    </div>
  ) : gif ? (
    <button onClick={() => saveCard(gif.file)}
      className="piece press py-4 font-display text-lg font-semibold bg-pop leading-tight">
      Save the film
      <span className="block text-[12px] font-bold opacity-70">{(gif.bytes / 1_000_000).toFixed(1)} MB GIF</span>
    </button>
  ) : (
    <button onClick={() => void save()}
      className="piece press py-4 font-display text-lg font-semibold bg-pop">
      Make the film
    </button>
  );

  return (
    <div className="space-y-2.5">
      <button onClick={play} disabled={playing} aria-label="Play the replay"
        className="block w-full rounded-2xl border-[3px] border-ink overflow-hidden bg-hot">
        <canvas ref={canvas} width={SIZE} height={SIZE} className="block w-full h-auto" />
      </button>
      <div className={`grid gap-2.5 ${children ? "grid-cols-2" : ""}`}>
        {filmButton}
        {children}
      </div>
    </div>
  );
}
