import { QuestionPanel, Timer } from "@/features/squareoff/QuestionPanel";
import { LOCK_MS, useLockIn } from "@/features/play/lockIn";
import { Catapult } from "@/features/challenge/Catapult";
import { targetFor } from "@/features/challenge/rules";
import type { PlayItem } from "@/features/play/types";
import type { Mark, Stall } from "@/features/play/board";
import type { Shot, Target } from "@/features/challenge/rules";

/**
 * What a move costs, drawn.
 *
 * Square Off and Connect 4 had a byte-identical copy of this — the question,
 * the clock, the catapult, and the button that moves a stuck reveal on. The two
 * rooms differ in their board and in whether a miss can be stolen; they do not
 * differ in any of this, and keeping two copies is how the reveal rescue came
 * to be missing from one of them once already.
 */
export function TurnPanel({
  challenge, item, options, chosen, setChosen, onAnswer,
  asking, revealed, mine, fraction, askedAt, waitingOn, botShot, target,
  advanceOwner, stall, myMark, onAdvanceNow, onForceAdvance, nextLabel, sheet = false,
}: {
  /** drawn inside the question sheet (#26) */
  sheet?: boolean;
  challenge: "trivia" | "catapult";
  item: PlayItem | null;
  options: string[];
  chosen: string | null;
  setChosen: (o: string | null) => void;
  /** the verdict, and the option tapped (none for a catapult shot) */
  onAnswer: (correct: boolean, given?: string) => void;
  asking: boolean;
  revealed: boolean;
  /** whether the pending answer is yours to give */
  mine: boolean;
  fraction: number;
  /** the question's shared seed (the writer's own updated_at), identical on
      both phones: the catapult's pot is drawn from it. Not a clock. */
  askedAt: number;
  /** the other player's name, for "… is lining one up" */
  waitingOn: string;
  /** A shot to play back. Solo hands the bot's over; in a room nobody stores
      the opponent's, so they see the target and then the result. */
  botShot?: Shot | null;
  /** Solo keeps its own target because it has no row to seed from. A room
      passes none and it is derived from askedAt, which both phones share. */
  target?: Target | null;
  /** who owes the move on from this reveal, if anyone */
  advanceOwner: Mark | null;
  stall: Stall | null;
  myMark: Mark | null;
  onAdvanceNow: () => void;
  onForceAdvance: () => void;
  /** Square Off says "Let them try it" when a miss hands the square over. */
  nextLabel: string;
}) {
  // Keyed on the question and the phase, so every new ask starts unlocked.
  const lock = useLockIn(`${item?.id}|${asking}`);
  /* The pause is skippable. A shorter fixed timer is not the same thing as
     being able to move on when you have finished reading. Once a reveal is
     stuck, whoever stallWriter names gets the same button rather than sitting
     out the grace period — the two conditions can never be true on both
     screens at once. */
  const moveOn = advanceOwner !== null && (
    advanceOwner === myMark ? (
      <button onClick={onAdvanceNow}
        className="cut tap w-full min-h-[52px] font-display text-[19px] cut-petal">
        {nextLabel}
      </button>
    ) : stall?.action === "advance" && stall.mark === myMark ? (
      <button onClick={onForceAdvance}
        className="cut tap w-full py-3.5 font-display text-lg font-semibold cut-ink text-ground">
        Move it on
      </button>
    ) : null
  );

  if (challenge === "catapult") {
    return (
      <div className="space-y-3">
        {/* Seeded on when the turn was written, which both phones read off the
            same row — so they see the same target without another column. */}
        <Catapult
          key={target ? target.x : askedAt}
          target={target ?? targetFor(askedAt, "medium")}
          locked={!mine || revealed}
          shot={botShot}
          onFire={(hit) => onAnswer(hit)}
          // Only while the other side is genuinely the one shooting. Keyed off
          // "not mine" it replaced your own "Just long." the instant you fired,
          // so you never learned anything from the shot you just took.
          note={!mine && asking ? `${waitingOn} is lining one up` : undefined} />
        {moveOn}
      </div>
    );
  }

  if (!item) return null;
  return (
    <div className="space-y-2.5">
      {asking && <Timer fraction={fraction} />}
      <QuestionPanel sheet={sheet}
        // Already permuted by loadContent, seeded on the puzzle id — do NOT
        // shuffle again here, or the two players see different orders.
        item={item} options={options} chosen={lock.picked ?? chosen}
        revealed={revealed} locked={!mine || revealed || lock.picked !== null}
        // Locked in first, then answered. With the clock nearly out the pause is
        // skipped, so a last-second tap still lands before time does.
        onAnswer={(opt) => {
          setChosen(opt);
          lock.pick(opt, (o) => onAnswer(o === item.answer, o), fraction < 0.1 ? 0 : LOCK_MS);
        }} />
      {moveOn}
    </div>
  );
}
