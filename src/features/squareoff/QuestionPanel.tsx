import { motion } from "framer-motion";
import { AnswerMark } from "@/shared/brand/Pieces";
import { stagger, riseIn } from "@/shared/ui/motion";
import type { PlayItem } from "@/features/play/types";


export function Timer({ fraction }: { fraction: number }) {
  return (
    <div className="h-3 bg-mist rounded-full overflow-hidden shadow-lift-sm">
      <motion.div
        className="h-full"
        style={{ background: fraction < 0.3 ? "var(--color-ember)" : "var(--color-petal)" }}
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
  item, options, chosen, revealed, locked, onAnswer, answer,
}: {
  item: PlayItem;
  options: string[];
  /** what was picked — the human's tap, or the bot's choice, shown either way */
  chosen: string | null;
  revealed: boolean;
  locked: boolean;
  onAnswer: (opt: string) => void;
  /** the correct answer, for modes that don't ship it on the item. The daily
      serves questions answer-free (item.answer is ""), so the reveal takes the
      correct answer from the server verdict instead -- without it, the right
      option never turns green and a correct pick shows the red cross. */
  answer?: string;
}) {
  const correctAnswer = answer ?? item.answer;
  // Built from the drawing's own code (#16–#18: .chip, .q, .opts, .opt), not
  // from a screenshot of it: 11px between the parts, as the drawing's screen has.
  return (
    <div className="grid gap-[11px]">
      <span className="chip justify-self-start text-[12px] font-extrabold bg-sky-hi text-ink rounded-full px-[9px] py-0.5">
        {item.category} · {item.difficulty.charAt(0).toUpperCase() + item.difficulty.slice(1)}
      </span>
      {/* The question on its own white card, in the reading face (.q: 700
          19px/1.3). A heading for screen readers, but not an <h2>: index.css
          sets every h2 in the display face at 400. */}
      <p role="heading" aria-level={2}
        className="card shadow-lift-sm rounded-[20px] px-4 py-3.5 text-[19px] leading-[1.3] font-bold text-pretty">
        {item.prompt}
      </p>

      <motion.div variants={stagger(0.05)} initial="hidden" animate="show" className="grid gap-2">
        {options.map((opt, i) => {
          const isAnswer = opt === correctAnswer;
          const isMine = chosen === opt;
          // .opt.right / .opt.wrong are a top-lit gradient; the rest step back
          // (.opt.dim, opacity .55). Not with an opacity class on the button:
          // the rise-in animation sets opacity inline, so it never showed.
          const dim = revealed && !isAnswer && !isMine;
          const bg = !revealed
            ? (isMine ? "bg-petal" : "bg-board")
            : isAnswer ? "bg-linear-to-b from-leaf-hi to-leaf text-ink"
            : isMine ? "bg-linear-to-b from-ember-hi to-ember text-ink"
            : "bg-board/55 [&>*]:opacity-55";
          const tag = revealed && isAnswer ? "Right" : revealed && isMine ? "You" : null;
          return (
            <motion.button key={opt} variants={riseIn}
              disabled={locked}
              onClick={() => onAnswer(opt)}
              data-dim={dim || undefined}
              className={`card shadow-lift-sm ${locked ? "" : "tap"} flex items-center gap-2.5 text-left rounded-2xl px-3 py-[11px] ${bg}`}>
              <AnswerMark index={i} size={22} state={revealed && isAnswer ? "right" : revealed && isMine ? "wrong" : "idle"} />
              {revealed && isAnswer && <span className="sr-only">Correct answer: </span>}
              {revealed && isMine && !isAnswer && <span className="sr-only">Your incorrect answer: </span>}
              <span className="text-[15px] font-bold flex-1">{opt}</span>
              {tag && <span aria-hidden className="shrink-0 text-[12px] font-extrabold bg-board/60 text-ink rounded-full px-[9px] py-[3px] leading-none">{tag}</span>}
            </motion.button>
          );
        })}
      </motion.div>

      {revealed && item.explanation && (
        <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="card p-3.5 text-[14px] font-semibold leading-snug">
          {item.explanation}
        </motion.p>
      )}
    </div>
  );
}
