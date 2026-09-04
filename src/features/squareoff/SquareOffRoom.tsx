import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import type { RoomPlayer } from "@/shared/types/db";
import { popIn } from "@/shared/ui/motion";
import { Button } from "@/shared/ui/Button";
import { Board } from "./Board";
import { QuestionPanel, Timer } from "./QuestionPanel";
import { describe, type Mark } from "./rules";
import { useTttRoom } from "./useTttRoom";
import { ASK_MS } from "./useSquareOff";

export function SquareOffRoom({
  roomId, players, userId, isHost,
}: { roomId: number; players: RoomPlayer[]; userId: string; isHost: boolean }) {
  const t = useTttRoom(roomId, userId);
  const [chosen, setChosen] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  const g = t.game;
  const asking = g?.phase === "asking";
  const mine = asking && g.answerer === t.myMark;

  // One clock, derived from when the question was written, so both screens agree.
  useEffect(() => {
    if (!asking) return;
    const id = setInterval(() => setNow(Date.now()), 120);
    return () => clearInterval(id);
  }, [asking, t.askedAt]);

  useEffect(() => { setChosen(null); }, [t.item?.id, g?.steal]);

  // Whoever owes the answer also owes the timeout, or nobody does. The ref stops
  // the tick firing it again in every frame between the write and the echo back.
  const left = ASK_MS - (now - t.askedAt);
  const timedOut = useRef<number>(-1);
  useEffect(() => {
    if (!mine || left > 0 || !t.item || timedOut.current === t.askedAt) return;
    timedOut.current = t.askedAt;
    t.submit(false);
  }, [mine, left, t]);

  if (!t.ready) return <p className="text-sm text-soft font-bold">Loading questions…</p>;

  if (!g) {
    const guest = players.find((p) => p.user_id !== userId);
    return (
      <div className="piece p-5 text-center">
        <p className="font-display text-xl font-semibold">Square Off</p>
        <p className="text-sm text-soft font-semibold mt-1">
          Claim a square by answering right. Miss, and your opponent gets one shot at it.
        </p>
        {isHost ? (
          guest
            ? <Button className="w-full mt-4" onClick={() => void t.start(userId, guest.user_id)}>
                Start against {guest.username}
              </Button>
            : <p className="text-sm text-soft mt-4 font-bold">Waiting for someone to join…</p>
        ) : (
          <p className="text-sm text-soft mt-4 font-bold">Waiting for the host to deal…</p>
        )}
      </div>
    );
  }

  // Names come from the seat, not from "the other person in the list" — with a
  // spectator or a third join that guess puts the wrong name on the wrong mark.
  const nameOf = (m: Mark) =>
    players.find((p) => p.user_id === t.seats[m])?.username ?? (m === "x" ? "Host" : "Guest");
  const names: Record<Mark, string> = { x: nameOf("x"), o: nameOf("o") };
  const revealed = g.phase === "revealed" || g.phase === "over";

  return (
    <div className="space-y-4">
      <div className="flex justify-center gap-2">
        {(["x", "o"] as Mark[]).map((m) => {
          const active = g.phase === "asking" ? g.answerer === m : g.turn === m;
          return (
            <motion.div key={m} animate={{ scale: active && g.phase !== "over" ? 1 : 0.94, opacity: active || g.phase === "over" ? 1 : 0.5 }}
              className={`piece flex items-center gap-2 px-3 py-2 ${active && g.phase !== "over" ? "bg-pop" : "bg-surface"}`}>
              <span className="font-display text-xl font-semibold leading-none"
                style={{ color: m === "x" ? "var(--color-picto)" : "var(--color-trivia)" }}>
                {m === "x" ? "✕" : "◯"}
              </span>
              <span className="text-[13px] font-black uppercase tracking-wide">{names[m]}</span>
            </motion.div>
          );
        })}
      </div>

      <Board board={g.board} target={g.target} line={g.line}
        canPick={g.phase === "picking" && g.turn === t.myMark}
        compact={g.phase === "asking" || g.phase === "revealed"}
        onPick={t.choose} />

      <p className="text-center text-[15px] font-bold text-soft min-h-[24px]">
        {describe(g, names, t.myMark)}
      </p>

      {g.phase === "over" ? (
        <motion.div variants={popIn} initial="hidden" animate="show"
          className={`piece p-6 text-center ${
            g.winner === "draw" ? "bg-sand"
              : g.winner === t.myMark ? "bg-good text-surface" : "bg-bad text-surface"}`}>
          <p className="font-display text-3xl font-semibold">
            {g.winner === "draw" ? "Draw" : g.winner === t.myMark ? "You win" : `${names[g.winner as Mark]} wins`}
          </p>
          <button onClick={() => void t.rematch()}
            className="piece press w-full mt-5 py-3.5 font-display text-lg font-semibold bg-surface text-ink">
            Rematch
          </button>
        </motion.div>
      ) : t.item && (g.phase === "asking" || g.phase === "revealed") ? (
        <div className="space-y-3">
          {asking && <Timer fraction={Math.max(0, left / ASK_MS)} />}
          <QuestionPanel
            // Already permuted by loadContent, seeded on the puzzle id — do NOT
            // shuffle again here, or the two players see different orders.
            item={t.item} options={t.item.choices ?? []} chosen={chosen}
            revealed={revealed} locked={!mine || revealed}
            onAnswer={(opt) => { setChosen(opt); t.submit(opt === t.item!.answer); }} />
        </div>
      ) : null}
    </div>
  );
}
