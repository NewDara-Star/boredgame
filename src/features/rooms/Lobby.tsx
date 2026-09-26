import { motion } from "framer-motion";
import type { Room, RoomPlayer } from "@/shared/types/db";
import { stagger, riseIn, SPRING } from "@/shared/ui/motion";
import { Avatar } from "@/shared/ui/Avatar";

import { ROOM_GAMES } from "@/features/play/registry";
import { LEVELS, type Level } from "@/features/play/scope";
import { CHALLENGES, roomSetup, roomWith, type Challenge } from "@/features/challenge/kinds";

interface Tile { slug: string; name: string; bank: boolean; on: (r: Room) => boolean }
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

  const inPool = picked.length
    ? categories.filter((c) => picked.includes(c.name)).reduce((n, c) => n + c.count, 0)
    : categories.reduce((n, c) => n + c.count, 0);

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
    <motion.div variants={stagger(0.06)} initial="hidden" animate="show" className="space-y-4">
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
        <p className="text-[12px] font-black text-soft mb-2">
          {n()} · Questions from <span className="text-soft/60">optional</span>
        </p>
        <div className="card p-3.5">
          <div className="flex flex-wrap gap-1.5">
            {categories.length === 0 && (
              <p className="text-sm font-bold text-soft">Loading this game's categories…</p>
            )}
            {categories.map((c) => {
              const on = picked.includes(c.name);
              return (
                // Counted at the chosen difficulty, so a category can read 0 —
                // Design has no easy questions in it. Picking it anyway would
                // start a game with nothing to deal.
                <button key={c.name} disabled={c.count === 0 && !on}
                  onClick={() => onSetup(room.mode, room.game,
                    on ? picked.filter((n) => n !== c.name) : [...picked, c.name], levelsOn, challenge)}
                  className={` shadow-lift-sm rounded-full px-2.5 py-1 text-[12px] font-bold
                    disabled:opacity-40
                    ${on ? "bg-ink text-ground" : "bg-board text-ink"}`}>
                  {c.name} <span className="opacity-60 tabular-nums">{c.count}</span>
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2 mt-3">
            <p className="text-[13px] font-black text-soft flex-1">
              {picked.length === 0 ? "All categories" : `${picked.length} selected`}
              <span className="text-soft/60"> · {inPool} to draw from</span>
            </p>
            {picked.length > 0 && (
              <button onClick={() => onSetup(room.mode, room.game, [], levelsOn, challenge)}
                className=" shadow-lift-sm rounded-full px-2.5 py-1 text-[13px] font-black bg-petal">Clear</button>
            )}
          </div>
        </div>
      </motion.section>
      )}

      {asks && (
      <motion.section variants={riseIn}>
        <p className="text-[12px] font-black text-soft mb-2">
          {n()} · How hard? <span className="text-soft/60">optional</span>
        </p>
        <div className="card p-3.5">
          <div className="grid grid-cols-3 gap-2">
            {LEVELS.map((l) => {
              const on = levelsOn.includes(l);
              const n = levels[l] ?? 0;
              return (
                <button key={l} disabled={n === 0}
                  onClick={() => onSetup(room.mode, room.game, picked,
                    on ? levelsOn.filter((x) => x !== l) : [...levelsOn, l], challenge)}
                  className={`cut tap py-2.5 disabled:opacity-40
                    ${on ? "cut-petal text-ink" : "bg-board"}`}>
                  <span className="block font-display text-base font-semibold capitalize">{l}</span>
                  <span className="block text-[13px] font-bold tabular-nums opacity-70">{n}</span>
                </button>
              );
            })}
          </div>
          <p className="text-[13px] font-black text-soft mt-3">
            {levelsOn.length === 0
              ? "Every level — about one question in five is hard"
              : `${levelsOn.join(" and ")} only`}
          </p>
        </div>
      </motion.section>
      )}

      <motion.section variants={riseIn}>
        <p className="text-[12px] font-black text-soft mb-2">
          {n()} · Both of you happy?
        </p>
        <div className="grid gap-2">
          {players.map((p) => (
            <motion.div key={p.user_id} layout transition={SPRING}
              className={`card flex items-center gap-3 px-3 py-2.5 ${p.ready ? "bg-leaf text-ink" : ""}`}>
              <Avatar id={p.user_id} name={p.username} size={34} />
              <span className="flex-1 font-bold text-[15px] truncate">
                {p.username}{p.user_id === userId && <span className="opacity-60 text-[13px] font-black ml-1.5">you</span>}
              </span>
              <span className="text-[13px] font-black">
                {p.ready ? "Ready" : "Deciding…"}
              </span>
            </motion.div>
          ))}
          {alone && (
            <div className="card px-3 py-2.5 bg-mist text-soft text-[13px] font-bold">
              Waiting for someone to join — send them the code above.
            </div>
          )}
        </div>

        <button
          disabled={alone}
          onClick={() => onReady(!me?.ready)}
          className={`cut tap w-full mt-3 py-4 font-display text-lg font-semibold
            ${me?.ready ? "bg-board" : "cut-petal"}`}>
          {alone ? "Waiting for a second player"
            : me?.ready ? "Not ready after all" : "I'm ready"}
        </button>

        {everyoneReady && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="text-center text-sm font-black text-leaf mt-3">
            Both ready — starting…
          </motion.p>
        )}
        <p className="text-[13px] font-bold text-soft text-center mt-2">
          Changing anything above un-readies you both.
        </p>
      </motion.section>
    </motion.div>
  );
}
