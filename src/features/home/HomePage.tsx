import { Link } from "react-router-dom";
import { PICTO_SEED } from "@/shared/data/picto";
import { TRIVIA_SEED } from "@/shared/data/trivia";
import { PictoRenderer } from "@/features/picto/PictoRenderer";
import { readLocal } from "@/features/play/progress";
import { rankFor } from "@/features/play/rank";

export function HomePage() {
  const p = readLocal();
  const { current, next, progress } = rankFor(p.answered);
  const teaser = PICTO_SEED[Math.floor(Math.random() * PICTO_SEED.length)];

  return (
    <div>
      <h1 className="text-4xl font-bold tracking-tight">Two games.<br />Pick your poison.</h1>
      <p className="text-dim mt-3 text-sm max-w-md">
        Short rounds, no ads, no feed. Built to be opened for four minutes and closed again.
      </p>

      <div className="grid gap-3 mt-7 sm:grid-cols-2">
        <Link to="/picto"
          className="group border border-line rounded-2xl p-5 bg-panel hover:border-picto transition block">
          <div className="h-24 text-picto mb-4"><PictoRenderer spec={{ items: teaser.items }} /></div>
          <p className="text-[10px] uppercase tracking-widest text-faint">Word puzzle</p>
          <h2 className="text-xl font-bold mt-1">Picto Phrase</h2>
          <p className="text-sm text-dim mt-1">Read the picture, name the phrase.</p>
          <p className="text-xs text-faint mt-3">{PICTO_SEED.length} puzzles</p>
        </Link>

        <Link to="/trivia"
          className="group border border-line rounded-2xl p-5 bg-panel hover:border-trivia transition block">
          <div className="h-24 mb-4 grid place-items-center">
            <span className="text-5xl" style={{ color: "var(--color-trivia)" }}>★</span>
          </div>
          <p className="text-[10px] uppercase tracking-widest text-faint">Quiz</p>
          <h2 className="text-xl font-bold mt-1">Star Trivia</h2>
          <p className="text-sm text-dim mt-1">Four options, one right, ten questions.</p>
          <p className="text-xs text-faint mt-3">{TRIVIA_SEED.length} questions</p>
        </Link>
      </div>

      <div className="mt-7 border border-line rounded-2xl p-5 bg-panel">
        <div className="flex items-baseline justify-between">
          <p className="text-[10px] uppercase tracking-widest text-faint">Your rank</p>
          <p className="text-xs text-faint tabular-nums">{p.answered} answered</p>
        </div>
        <p className="text-2xl font-bold mt-1">{current.name}</p>
        <div className="h-1.5 bg-ink rounded-full mt-3 overflow-hidden">
          <div className="h-full bg-picto rounded-full transition-all"
            style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
        <p className="text-xs text-faint mt-2">
          {next ? `${next.min - p.answered} more to ${next.name}` : "Top rank reached"}
        </p>
      </div>

      <Link to="/rooms" className="block mt-3 border border-dashed border-line rounded-2xl p-4 text-center text-sm text-dim hover:text-chalk hover:border-picto transition">
        Head-to-head — race someone on the same puzzle →
      </Link>
    </div>
  );
}
