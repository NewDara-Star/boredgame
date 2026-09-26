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
  return (
    <div>
      {/* #16: the question sits on its own white card, in the reading face, so
          it holds on any sky, day or night. It was bare display type on the sky. */}
      <span className="chip inline-block text-[12px] font-black bg-sky-hi text-ink rounded-full px-2.5 py-1">
        {item.category} · {item.difficulty.charAt(0).toUpperCase() + item.difficulty.slice(1)}
      </span>
      {/* A heading for screen readers, but not an <h2>: index.css sets every h2
          in the display face at 400, and a question reads in the reading face. */}
      <p role="heading" aria-level={2} className="card mt-2 px-4 py-3.5 text-[19px] leading-snug font-extrabold text-balance">
        {item.prompt}
      </p>

      <motion.div variants={stagger(0.05)} initial="hidden" animate="show" className="mt-4 grid gap-2">
        {options.map((opt, i) => {
          const isAnswer = opt === correctAnswer;
          const isMine = chosen === opt;
          // The rest step back (#17). Not with opacity: the rise-in animation
          // sets it inline, so an opacity class never showed (they stayed white).
          const bg = !revealed
            ? (isMine ? "bg-petal" : "bg-board")
            : isAnswer ? "bg-leaf text-ink"
            : isMine ? "bg-ember text-ink"
            : "bg-board/50 text-soft [&_svg]:opacity-50";
          const tag = revealed && isAnswer ? "Right" : revealed && isMine ? "You" : null;
          return (
            <motion.button key={opt} variants={riseIn}
              disabled={locked}
              onClick={() => onAnswer(opt)}
              className={`card ${locked ? "" : "tap"} flex items-center gap-3 text-left px-4 py-3 ${bg}`}>
              <span aria-hidden={!(revealed && (isAnswer || isMine))} className="text-base shrink-0"
                >
                  <AnswerMark index={i} state={revealed && isAnswer ? "right" : revealed && isMine ? "wrong" : "idle"} />
              </span>
              {revealed && isAnswer && <span className="sr-only">Correct answer: </span>}
              {revealed && isMine && !isAnswer && <span className="sr-only">Your incorrect answer: </span>}
              <span className="text-[16px] font-extrabold flex-1">{opt}</span>
              {tag && <span aria-hidden className="shrink-0 text-[12px] font-black bg-board/80 text-ink rounded-full px-2 py-0.5">{tag}</span>}
            </motion.button>
          );
        })}
      </motion.div>

      {revealed && item.explanation && (
        <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="card p-3.5 mt-2.5 text-[14px] font-semibold leading-snug">
          {item.explanation}
        </motion.p>
      )}
    </div>
  );
}
