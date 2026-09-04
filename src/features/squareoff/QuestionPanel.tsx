import { motion } from "framer-motion";
import { stagger, riseIn } from "@/shared/ui/motion";
import type { PlayItem } from "@/features/play/types";

const SHAPES = ["▲", "◆", "●", "■"];
const HUES = ["#EF5A2A", "#4B5BD6", "#FFC93C", "#17914B"];

export function Timer({ fraction }: { fraction: number }) {
  return (
    <div className="h-3 bg-sand rounded-full overflow-hidden border-2 border-ink">
      <motion.div
        className="h-full"
        style={{ background: fraction < 0.3 ? "var(--color-bad)" : "var(--color-pop)" }}
        animate={{ width: `${Math.max(0, fraction) * 100}%` }}
        transition={{ duration: 0.2, ease: "linear" }} />
    </div>
  );
}

/**
 * One question panel for both modes. `locked` covers every case where the
 * options are visible but not yours to press: the bot thinking, the opponent
 * answering, and the moment after an answer lands.
 */
export function QuestionPanel({
  item, options, chosen, revealed, locked, onAnswer,
}: {
  item: PlayItem;
  options: string[];
  /** what was picked — the human's tap, or the bot's choice, shown either way */
  chosen: string | null;
  revealed: boolean;
  locked: boolean;
  onAnswer: (opt: string) => void;
}) {
  return (
    <div>
      <span className="inline-block text-[10px] font-black uppercase tracking-widest
        bg-trivia text-surface rounded-full px-2.5 py-1">
        {item.category} · {item.difficulty}
      </span>
      <h2 className="mt-2.5 font-display text-[22px] leading-tight font-semibold text-balance">
        {item.prompt}
      </h2>

      <motion.div variants={stagger(0.05)} initial="hidden" animate="show" className="mt-4 grid gap-2">
        {options.map((opt, i) => {
          const isAnswer = opt === item.answer;
          const isMine = chosen === opt;
          const bg = !revealed
            ? (isMine ? "bg-pop" : "bg-surface")
            : isAnswer ? "bg-good text-surface"
            : isMine ? "bg-bad text-surface"
            : "bg-surface opacity-40";
          return (
            <motion.button key={opt} variants={riseIn}
              disabled={locked}
              onClick={() => onAnswer(opt)}
              className={`piece ${locked ? "" : "press"} flex items-center gap-3 text-left px-4 py-3.5 ${bg}`}>
              <span aria-hidden className="text-base shrink-0"
                style={{ color: revealed && (isAnswer || isMine) ? "currentColor" : HUES[i % 4] }}>
                {SHAPES[i % 4]}
              </span>
              <span className="text-[15px] font-bold">{opt}</span>
            </motion.button>
          );
        })}
      </motion.div>

      {revealed && item.explanation && (
        <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="piece p-3.5 mt-2.5 text-[14px] font-semibold leading-snug">
          {item.explanation}
        </motion.p>
      )}
    </div>
  );
}
