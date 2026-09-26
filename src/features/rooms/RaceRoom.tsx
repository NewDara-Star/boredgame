import { useEffect, useState, type ReactNode } from "react";
import type { Room, RoomPlayer, RoomRound } from "@/shared/types/db";
import type { PlayItem } from "@/features/play/types";
import { PictoRenderer, PICTURE_ALT } from "@/features/picto/PictoRenderer";
import { QuestionPanel } from "@/features/squareoff/QuestionPanel";
import { PlayBoard, PlaySurface, Seats } from "@/features/play/PlaySurface";
import { LOCK_MS, sleep } from "@/features/play/lockIn";
import { serverToLocal } from "@/shared/lib/serverClock";
import { MatchOver, useMatchChrome } from "./matchUi";
import { markOf } from "./RoomScreens";

type Claim = { won?: boolean; reason?: string } | null;

/**
 * The races (#40): the same puzzle on both phones, the first right answer
 * takes the round. Picto is the rebus, full width, with the answer field under
 * it and "typing…" on the other seat while they type (Daramola, 26 Sep).
 * Trivia is the question card and its four options, one pick each.
 */
export function RaceRoom({ top, room, players, userId, isHost, round, puzzle, claimRound, revealRound, startNextRound, typing, sendTyping }: {
  /** the top bar, given what goes at its right-hand end ("Round 2 of 5") */
  top: (end: ReactNode) => ReactNode;
  room: Room; players: RoomPlayer[]; userId: string; isHost: boolean;
  round: RoomRound | null; puzzle: PlayItem | null;
  claimRound: (given: string) => Promise<Claim>;
  revealRound: () => Promise<void>;
  startNextRound: () => Promise<void>;
  typing: Record<string, number>;
  sendTyping: () => void;
}) {
  const [guess, setGuess] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const [outOf, setOutOf] = useState<number | null>(null);
  const [notIt, setNotIt] = useState(false);
  const [tick, setTick] = useState(() => Date.now());
  useEffect(() => { const id = setInterval(() => setTick(Date.now()), 500); return () => clearInterval(id); }, []);

  const guest = players.find((p) => p.user_id !== room.host_id);
  const seatsById = { x: room.host_id, o: guest?.user_id ?? null };
  const picto = room.game === "picto";
  const { names, scoreOf, sides, card, done } =
    useMatchChrome(room.code, picto ? "PICTO PHRASE" : "STAR TRIVIA", room.status, players, seatsById, false,
      { hero: () => () => {}, me: markOf(room, userId) });

  if (done) return <MatchOver sides={sides} myMark={markOf(room, userId)} card={card} roomId={room.id} />;

  const me = markOf(room, userId), them = me === "x" ? "o" : "x";
  const themId = seatsById[them];
  const won = round?.winner_id ?? null;
  const ended = !!round && !won && !!round.ended_at;
  const over = !!won || ended;
  const out = !!round && outOf === round.id;
  const canReveal = !!round && !over && tick - serverToLocal(round.started_at) >= 20_000;
  const theyType = !!themId && tick - (typing[themId] ?? 0) < 2500;
  const count = (n: number) => `${n} round${n === 1 ? "" : "s"}`;
  const end = round ? <span className="chip rounded-full bg-sky-hi px-[9px] py-0.5 text-[12px] font-extrabold text-ink">Round {round.round_no} of {room.best_of}</span> : null;

  const answerForm = round ? (
        <form className="w-full flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!guess.trim()) return;
            // Typed races keep their guesses; a miss says so.
            void claimRound(guess).then((v) => {
              if (v && !v.won && !v.reason) { setNotIt(true); setTimeout(() => setNotIt(false), 1500); }
            });
            setGuess("");
          }}>
          <input value={guess} onChange={(e) => { setGuess(e.target.value); if (e.target.value) sendTyping(); }}
            aria-label="Your answer" placeholder="Your answer"
            // as in solo Picto (talk item 6): no autocorrect, no capital
            autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck={false} enterKeyHint="go"
            className="min-w-0 flex-1 rounded-[14px] bg-board px-3.5 py-3 text-[16px] font-semibold text-ink shadow-[inset_0_0_0_2.5px_var(--color-sky)] outline-none" />
          <button type="submit" className="cut tap cut-petal px-5 min-h-[48px] font-display text-[19px]">Go</button>
        </form>
  ) : null;

  const seats = (
    <Seats seats={[
      { mark: me, name: "You", initial: names[me], count: count(scoreOf(me)), active: won === userId },
      { mark: them, name: names[them], initial: names[them], count: picto && theyType && !over ? "typing…" : count(scoreOf(them)), active: !!won && won === themId },
    ]} />
  );

  return (
    <PlaySurface focus>
      {top(end)}
      {!round || !puzzle ? (
        <p className="flex-1 grid place-items-center text-[15px] font-bold text-soft">Dealing the round…</p>
      ) : picto ? (
        <PlayBoard ratio={1} min={120} top reserve={over ? 69 : 127}>
          {(width) => (
            <>
              <div className="card grid place-items-center rounded-[22px] bg-board p-4 text-ink" style={{ width, height: width }}>
                {puzzle.spec ? <PictoRenderer spec={puzzle.spec} />
                  : puzzle.render === "image" && puzzle.imageUrl ? <img src={puzzle.imageUrl} alt={PICTURE_ALT} className="max-h-full object-contain rounded-xl" />
                  : <p className="text-xl font-semibold text-center">{puzzle.prompt}</p>}
              </div>
              <div className="w-full">{seats}</div>
              {/* 40: the answer straight under the seats, where the keyboard can't hide it */}
              {!over && answerForm}
            </>
          )}
        </PlayBoard>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto grid content-start gap-2.5">
          <QuestionPanel item={puzzle} options={puzzle.choices ?? []} chosen={picked}
            revealed={over} locked={picked !== null || out || over}
            onAnswer={(opt) => {
              setPicked(opt);
              const id = round.id;
              // A race: the claim goes at once, and the pick stays lit at least
              // the locked-in moment. One pick each: a wrong one puts you out.
              void Promise.all([claimRound(opt), sleep(LOCK_MS)]).then(([v]) => {
                setPicked(null);
                if (v?.reason === "out") setOutOf(id);
              });
            }} />
          {seats}
        </div>
      )}

      {round && puzzle && (over ? (
        <div className="card shrink-0 grid gap-1 rounded-[20px] bg-board p-3.5 text-center text-ink" role="status">
          <b className="font-display font-normal text-[21px] leading-tight">
            {ended ? "Nobody got it" : won === userId ? "You took it" : `${names[them]} took it`}
          </b>
          {picto && <p className="text-[15px] font-bold">{puzzle.answer}</p>}
          {puzzle.explanation && <p className="text-[14px] font-semibold text-soft text-left">{puzzle.explanation}</p>}
          {isHost ? (
            <button onClick={() => void startNextRound()} className="cut tap cut-petal mt-1.5 min-h-[52px] font-display text-[19px]">
              {round.round_no >= room.best_of ? "See the result" : "Next round"}
            </button>
          ) : (
            <p className="text-[13px] font-bold text-soft mt-1">{names[them]} deals the next one.</p>
          )}
        </div>
      ) : null)}

      {round && !over && out && <p className="shrink-0 text-center text-[14px] font-bold" role="status">Out this round. {names[them]} can still take it.</p>}
      {round && !over && notIt && <p className="shrink-0 text-center text-[14px] font-bold" role="status">Not it. Keep going.</p>}
      {/* A round nobody can get used to have no way on but Leave (talk item 10). */}
      {canReveal && (
        <button onClick={() => void revealRound()}
          className="shrink-0 mx-auto min-h-[44px] text-[13px] font-extrabold text-soft underline underline-offset-4">
          Show the answer (nobody scores)
        </button>
      )}
    </PlaySurface>
  );
}
