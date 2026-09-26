import { motion } from "framer-motion";
import type { Room, RoomPlayer } from "@/shared/types/db";
import { stagger, riseIn } from "@/shared/ui/motion";
import { RoomSeats } from "./RoomScreens";

import { ROOM_GAMES } from "@/features/play/registry";
import { LEVELS, type Level } from "@/features/play/scope";
import { CHALLENGES, roomSetup, roomWith, type Challenge } from "@/features/challenge/kinds";

interface Tile { slug: string; name: string; bank: boolean; on: (r: Room) => boolean }

/** .cats span: a white pill, gold when on; 44px to tap. */
const chip = (label: string, on: boolean, onClick: () => void, disabled = false) => (
  <button key={label} aria-pressed={on} disabled={disabled} onClick={onClick}
    className="min-h-[44px] -my-[7px] grid place-items-center disabled:opacity-40">
    <span className={`card rounded-full px-[11px] py-[5px] text-[13px] font-extrabold ${on ? "bg-petal" : "bg-board"}`}>{label}</span>
  </button>
);
/** The room's games, as tiles (drawing 36b). */
const TILES: Tile[] = [
  { slug: "tictactoe", name: "Tic Tac Toe", bank: false, on: (r) => r.mode === "tictactoe" || r.mode === "squareoff" },
  { slug: "connect4", name: "Connect 4", bank: false, on: (r) => r.mode === "connect4" || r.mode === "connect4trivia" },
  { slug: "memory", name: "Memory Match", bank: false, on: (r) => r.mode === "memory" },
  { slug: "trivia", name: "Trivia race", bank: true, on: (r) => r.mode === "race" && r.game === "trivia" },
  { slug: "picto", name: "Picto race", bank: true, on: (r) => r.mode === "race" && r.game === "picto" },
  { slug: "ballsort", name: "Ball Sort race", bank: false, on: (r) => r.mode === "ballsort" },
];

/**
 * The settings used to be chosen by the host before the room existed, which
 * meant the person joining had no say in what they had turned up to play. Now
 * either of you can change any of it, and every change clears both ready flags
 * — that is what makes "ready" mean "I agree to this" rather than "I agreed to
 * whatever it was thirty seconds ago".
 */
export function Lobby({
  room, players, categories, levels, userId, alone, onSetup, onReady,
}: {
  room: Room;
  players: RoomPlayer[];
  categories: { name: string; count: number }[];
  /** how many questions sit at each level, inside the chosen categories */
  levels: Record<Level, number>;
  userId: string;
  alone: boolean;
  onSetup: (mode: string, game: string, cats: string[], levels: string[],
            challenge: string) => void;
  onReady: (ready: boolean) => void;
}) {
  const picked = room.categories ?? [];
  const levelsOn = room.difficulty ?? [];
  const challenge = room.challenge ?? "trivia";
  const me = players.find((p) => p.user_id === userId);
  const everyoneReady = players.length === room.capacity && players.every((p) => p.ready);

  // Step 1 is the game (drawing 36b): the two board games, then the rest. Tic Tac Toe
  // and Connect 4 are each one tile whatever they're played with; that's step 2.
  const tile = TILES.find((x) => x.on(room)) ?? null;
  const board = tile?.slug === "tictactoe" || tile?.slug === "connect4" ? tile.slug : null;
  const w: Challenge = board ? roomWith(room.mode, challenge) : "none";
  const pickTile = (t: Tile) => {
    if (t.slug === "tictactoe" || t.slug === "connect4") {
      // a board keeps what it was played with when you swap boards
      const r = roomSetup(t.slug, board ? w : "none");
      onSetup(r.mode, "trivia", room.game === "trivia" ? picked : [], levelsOn, r.challenge);
      return;
    }
    const g = ROOM_GAMES.find((x) => x.slug === t.slug);
    if (!g) return;
    onSetup(g.room.mode, g.bank ?? room.game, g.bank === room.game ? picked : [], levelsOn, "trivia");
  };
  const pickWith = (c: Challenge) => {
    if (!board) return;
    const r = roomSetup(board, c);
    // a board's questions come from the trivia bank
    onSetup(r.mode, "trivia", room.game === "trivia" ? picked : [], levelsOn, r.challenge);
  };
  // Questions only where something asks one: a race, or a board with Trivia or Mix.
  const asks = board ? w === "trivia" || w === "mix" : !!tile && tile.bank;
  const shots = w === "cup" || w === "hoops" || w === "knock" || w === "mix";
  let step = 0;
  const n = () => ++step;

  return (
    <motion.div variants={stagger(0.06)} initial="hidden" animate="show" className="flex flex-col gap-4 min-h-[calc(100dvh-90px-env(safe-area-inset-top)-env(safe-area-inset-bottom))]">
      <motion.section variants={riseIn}>
        <p className="text-[12px] font-extrabold text-soft mb-2">{n()} · Game</p>
        <div className="grid grid-cols-2 gap-[9px]">
          {TILES.map((t) => {
            const on = tile?.slug === t.slug;
            const Art = ROOM_GAMES.find((x) => x.slug === t.slug)?.Art;
            return (
              <button key={t.slug} aria-pressed={on} onClick={() => pickTile(t)}
                className={`card tap flex items-center gap-[9px] rounded-[18px] p-2.5 min-h-[62px] text-left ${on ? "bg-petal" : "bg-board"}`}>
                {Art && <span className="shrink-0 w-11 h-11 grid place-items-center"><Art size={44} /></span>}
                <b className="text-[14px] font-bold leading-[1.2]">{t.name}</b>
              </button>
            );
          })}
        </div>
      </motion.section>

      {board && (
      <motion.section variants={riseIn}>
        <p className="text-[12px] font-extrabold text-soft mb-2">{n()} · Play it with</p>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Play it with">
          {CHALLENGES.map((c) => (
            <button key={c.key} aria-pressed={w === c.key} onClick={() => pickWith(c.key)}
              className="min-h-[44px] -my-[7px] grid place-items-center">
              <span className={`card rounded-full px-[11px] py-[5px] text-[13px] font-extrabold ${w === c.key ? "bg-petal" : "bg-board"}`}>{c.name}</span>
            </button>
          ))}
        </div>
        <p className="text-[13px] font-semibold text-soft mt-2">
          {CHALLENGES.find((c) => c.key === w)?.says}
          {shots && " Shots start on Normal; miss two in a row and yours get easier."}
        </p>
      </motion.section>
      )}

      {asks && (
      <motion.section variants={riseIn}>
        <p className="text-[12px] font-extrabold text-soft mb-2">{n()} · Questions from</p>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Questions from">
          {categories.length === 0 && <p className="text-[13px] font-bold text-soft">Loading the categories…</p>}
          {categories.length > 0 && chip("All categories", picked.length === 0,
            () => onSetup(room.mode, room.game, [], levelsOn, challenge))}
          {categories.map((c) => {
            const on = picked.includes(c.name);
            // Counted at the chosen level, so a category can have nothing in it
            // (Design has no easy questions); it can't be picked then.
            return chip(c.name, on,
              () => onSetup(room.mode, room.game, on ? picked.filter((x) => x !== c.name) : [...picked, c.name], levelsOn, challenge),
              c.count === 0 && !on);
          })}
        </div>
      </motion.section>
      )}

      {asks && (
      <motion.section variants={riseIn}>
        <p className="text-[12px] font-extrabold text-soft mb-2">{n()} · How hard</p>
        {/* One chip row, as the solo quiz (Daramola, 26 Sep): any level, or one. */}
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="How hard">
          {chip("Any", levelsOn.length === 0, () => onSetup(room.mode, room.game, picked, [], challenge))}
          {LEVELS.map((l) => chip(l[0].toUpperCase() + l.slice(1), levelsOn.length === 1 && levelsOn[0] === l,
            () => onSetup(room.mode, room.game, picked, [l], challenge), (levels[l] ?? 0) === 0))}
        </div>
      </motion.section>
      )}

      <div className="flex-1" />
      {/* Ready sits at the bottom, under both seats (36). Changing anything
          above un-readies you both: "ready" means "I agree to this". */}
      <motion.section variants={riseIn} className="grid gap-2.5">
        <RoomSeats room={room} players={players} userId={userId}
          says={(p) => (p.ready ? "Ready" : "Deciding")} />
        <button disabled={alone} onClick={() => onReady(!me?.ready)}
          className={`cut tap w-full min-h-[52px] font-display text-[19px] ${me?.ready ? "cut-board" : "cut-petal"}`}>
          {alone ? "Waiting for a second player" : me?.ready ? "Not ready after all" : "I'm ready"}
        </button>
        {everyoneReady && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center text-[13px] font-extrabold">
            Both ready. Here we go…
          </motion.p>
        )}
      </motion.section>
    </motion.div>
  );
}
