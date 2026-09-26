import type { ReactNode } from "react";
import { ownersFor } from "@/features/play/board";
import type { Challenge, RoomPlayer, RoomStatus } from "@/shared/types/db";
import { Note, Dealing } from "@/shared/ui/Note";
import { EndMatchLink, MatchOver, useMatchChrome, useStallRescue } from "@/features/rooms/matchUi";
import { BetweenGames, NudgeButton, quietPeer, RoomBanner, RoomSeatRow, type BannerProps } from "@/features/rooms/RoomBoard";
import { Board } from "./Board";
import { PlayBoard, PlaySurface } from "@/features/play/PlaySurface";
import { memoryHero } from "./card";
import { describe, scoreOf, stallWriter, type Mark } from "./rules";
import { useMemoryRoom } from "./useMemoryRoom";
import { AWAY_MS } from "@/features/play/clock";

/** How long after a deadline passes before the other player takes over. */
const GRACE_MS = 6000;
/** When a reveal is considered stuck. Must sit above Memory's reveal
    (MEMORY_REVEAL_MS, 2.3 s) or this races the timer it exists to back up. */
const REVEAL_MS = 4500;
export function MemoryRoom({
  top, roomId, code, status, players, userId,
}: {
  /** the room's top bar (code, call) and its notices */
  top?: ReactNode;
  roomId: number; code: string; status: RoomStatus;
  challenge?: Challenge;
  players: RoomPlayer[]; userId: string;
}) {
  const t = useMemoryRoom(roomId, userId);
  const g = t.game;
  const { now, names, sides, card, done } =
    useMatchChrome(code, "MEMORY MATCH", status, players, t.seats, g?.phase === "asking",
      { hero: () => memoryHero(t.game?.board), me: t.myMark });

  /**
   * This room used to have no rescue at all, on the reasoning that every phase
   * is written by whoever's turn it is. That is true and it is exactly the
   * problem: `useBoardRoom` guards both the reveal timer and advanceNow on
   * `last.by === myMark`, so the pause that turns two tiles back over lives in
   * one tab, and a locked phone froze the board for both players permanently.
   *
   * There is no clock on looking at a grid, so `ask` here is the away deadline
   * rather than a rule — nothing counts down and nothing is drawn. `true` for
   * haveItem because a memory turn deals no question to wait for.
   */
  const elapsed = now - t.askedAt;
  const stall = g
    ? stallWriter(g, elapsed, { ask: AWAY_MS, reveal: REVEAL_MS, grace: GRACE_MS })
    : null;
  useStallRescue(stall, t.myMark, t.askedAt, true, t);

  if (done) return <MatchOver sides={sides} myMark={t.myMark} card={card} roomId={roomId} />;
  if (!g) return <Dealing what="the tiles" />;

  const mine = g.turn === t.myMark;
  const me: Mark = t.myMark ?? "x", them: Mark = me === "x" ? "o" : "x";
  const pairs = { x: scoreOf(g, "x"), o: scoreOf(g, "o") };
  const quiet = g.phase !== "over" && !mine ? quietPeer(players, userId, now) : null;
  const said = describe(g, names, t.myMark);
  const tally = <b className="font-mono font-bold text-[24px] shrink-0">{pairs[me]}–{pairs[them]}</b>;
  const banner: BannerProps = g.phase === "over"
    ? (g.winner === me ? { title: "You win this one", tone: "petal", flower: "bloom", end: tally }
      : g.winner === them ? { title: `${names[them]} wins this one`, tone: "white", flower: "bored", end: tally }
      : { title: "All square", tone: "white", flower: "awake", end: tally })
    : quiet ? { title: `${names[them]}'s gone quiet`, sub: "Their phone may be locked", tone: "white", flower: "look-right", end: <NudgeButton roomId={roomId} /> }
    : mine ? { title: "Your move", sub: said, tone: "petal", flower: "awake" }
    : { title: `${names[them]}'s move`, sub: said, tone: "white", flower: "look-right" };

  return (
    <PlaySurface focus>
      {top}
      <RoomBanner b={banner} />
      <PlayBoard min={78} top reserve={g.phase === "over" ? 69 : 113}>
        {(width) => (
          <>
            <Board owners={ownersFor(names, t.myMark)} game={g} width={width}
              canFlip={mine && (g.phase === "picking" || g.phase === "asking")}
              onFlip={t.choose} />
            <div className="w-full">
              <RoomSeatRow me={t.myMark} names={names} scores={pairs} active={g.phase === "over" ? null : g.turn}
                quiet={!!quiet} counting="pairs" />
            </div>
            {g.phase !== "over" && <EndMatchLink onQuit={() => void t.quit()} />}
          </>
        )}
      </PlayBoard>
      <Note>{t.error}</Note>
      {g.phase === "over" && <BetweenGames onRematch={() => void t.rematch()} onQuit={() => void t.quit()} onChangeGame={() => void t.changeGame()} />}
    </PlaySurface>
  );
}
