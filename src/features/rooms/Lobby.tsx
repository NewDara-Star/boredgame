import { motion } from "framer-motion";
import type { Room, RoomPlayer } from "@/shared/types/db";
import { stagger, riseIn, SPRING } from "@/shared/ui/motion";
import { Avatar } from "@/shared/ui/Avatar";

import { ROOM_GAMES } from "@/features/play/registry";
import { LEVELS, type Level } from "@/features/play/scope";

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

  // Plain Tic Tac Toe and plain Connect 4 draw on nothing, so the category step
  // is not "optional" for them, it is meaningless. Hide it rather than offer a
  // choice that changes nothing.
  const hasBank = ROOM_GAMES.some((g) => g.room.mode === room.mode && g.bank !== null);

  return (
    <motion.div variants={stagger(0.06)} initial="hidden" animate="show" className="space-y-4">
      <motion.section variants={riseIn}>
        <p className="text-[12px] font-black uppercase tracking-widest text-soft mb-2">
          1 · What are you playing?
        </p>
        <div className="grid gap-2">
          {ROOM_GAMES.map((g) => {
            const c = { mode: g.room.mode, game: g.bank, label: g.name, blurb: g.room.blurb };
            // A bankless game is identified by its mode alone. rooms.game is NOT
            // NULL, so it keeps whatever key was already there and ignores it.
            const on = room.mode === c.mode && (c.game === null || room.game === c.game);
            return (
              // Categories belong to a bank. Square Off and Trivia race share
                // one so a selection survives; switching to Picto race does not,
                // and five of the categories have no trivia in them at all.
                <button key={g.slug}
                  onClick={() => onSetup(c.mode, c.game ?? room.game, c.game === room.game ? picked : [], levelsOn, challenge)}
                className={`piece press text-left p-3.5 ${on ? "bg-hot text-surface" : "bg-surface"}`}>
                <span className="flex items-center gap-2">
                  <span className={`grid place-items-center h-5 w-5 rounded-full border-[3px] border-ink shrink-0
                    ${on ? "bg-surface" : "bg-sand"}`}>
                    {on && <span className="h-2 w-2 rounded-full bg-ink" />}
                  </span>
                  <span className="font-display text-lg font-semibold">{c.label}</span>
                </span>
                <span className={`block text-[13px] font-semibold mt-1 ${on ? "opacity-90" : "text-soft"}`}>
                  {c.blurb}
                </span>
              </button>
            );
          })}
        </div>
      </motion.section>

      {hasBank && (
      <motion.section variants={riseIn}>
        <p className="text-[12px] font-black uppercase tracking-widest text-soft mb-2">
          2 · Which categories? <span className="text-soft/60">optional</span>
        </p>
        <div className="piece p-3.5">
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
                  className={`border-2 border-ink rounded-full px-2.5 py-1 text-[12px] font-bold
                    disabled:opacity-40
                    ${on ? "bg-ink text-paper" : "bg-surface text-ink"}`}>
                  {c.name} <span className="opacity-60 tabular-nums">{c.count}</span>
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2 mt-3">
            <p className="text-[13px] font-black uppercase tracking-wider text-soft flex-1">
              {picked.length === 0 ? "All categories" : `${picked.length} selected`}
              <span className="text-soft/60"> · {inPool} to draw from</span>
            </p>
            {picked.length > 0 && (
              <button onClick={() => onSetup(room.mode, room.game, [], levelsOn, challenge)}
                className="border-2 border-ink rounded-full px-2.5 py-1 text-[13px] font-black
                  uppercase tracking-wider bg-pop">Clear</button>
            )}
          </div>
        </div>
      </motion.section>
      )}

      {hasBank && (
      <motion.section variants={riseIn}>
        <p className="text-[12px] font-black uppercase tracking-widest text-soft mb-2">
          3 · What does a move cost?
        </p>
        <div className="grid grid-cols-2 gap-2">
          {([
            ["trivia", "A question", "Four options. Rewards knowing things."],
            ["catapult", "A shot", "Aim a catapult at a target. Rewards aim, not age."],
          ] as const).map(([key, label, blurb]) => (
            <button key={key}
              onClick={() => onSetup(room.mode, room.game, picked, levelsOn, key)}
              className={`piece press p-3 text-left ${
                challenge === key ? "bg-hot text-surface" : "bg-surface"}`}>
              <span className="block font-display text-base font-semibold">{label}</span>
              <span className="block text-[12px] font-bold opacity-75 mt-0.5">{blurb}</span>
            </button>
          ))}
        </div>
      </motion.section>
      )}

      {hasBank && challenge === "trivia" && (
      <motion.section variants={riseIn}>
        <p className="text-[12px] font-black uppercase tracking-widest text-soft mb-2">
          4 · How hard? <span className="text-soft/60">optional</span>
        </p>
        <div className="piece p-3.5">
          <div className="grid grid-cols-3 gap-2">
            {LEVELS.map((l) => {
              const on = levelsOn.includes(l);
              const n = levels[l] ?? 0;
              return (
                <button key={l} disabled={n === 0}
                  onClick={() => onSetup(room.mode, room.game, picked,
                    on ? levelsOn.filter((x) => x !== l) : [...levelsOn, l], challenge)}
                  className={`piece press py-2.5 disabled:opacity-40
                    ${on ? "bg-hot text-surface" : "bg-surface"}`}>
                  <span className="block font-display text-base font-semibold capitalize">{l}</span>
                  <span className="block text-[13px] font-bold tabular-nums opacity-70">{n}</span>
                </button>
              );
            })}
          </div>
          <p className="text-[13px] font-black uppercase tracking-wider text-soft mt-3">
            {levelsOn.length === 0
              ? "Every level — about one question in five is hard"
              : `${levelsOn.join(" and ")} only`}
          </p>
        </div>
      </motion.section>
      )}

      <motion.section variants={riseIn}>
        <p className="text-[12px] font-black uppercase tracking-widest text-soft mb-2">
          {hasBank ? "5" : "2"} · Both of you happy?
        </p>
        <div className="grid gap-2">
          {players.map((p) => (
            <motion.div key={p.user_id} layout transition={SPRING}
              className={`piece flex items-center gap-3 px-3 py-2.5 ${p.ready ? "bg-good text-surface" : ""}`}>
              <Avatar id={p.user_id} name={p.username} size={34} />
              <span className="flex-1 font-bold text-[15px] truncate">
                {p.username}{p.user_id === userId && <span className="opacity-60 text-[13px] font-black uppercase tracking-widest ml-1.5">you</span>}
              </span>
              <span className="text-[13px] font-black uppercase tracking-wider">
                {p.ready ? "Ready" : "Deciding…"}
              </span>
            </motion.div>
          ))}
          {alone && (
            <div className="piece px-3 py-2.5 bg-sand text-soft text-[13px] font-bold">
              Waiting for someone to join — send them the code above.
            </div>
          )}
        </div>

        <button
          disabled={alone}
          onClick={() => onReady(!me?.ready)}
          className={`piece press w-full mt-3 py-4 font-display text-lg font-semibold
            ${me?.ready ? "bg-surface" : "bg-pop"}`}>
          {alone ? "Waiting for a second player"
            : me?.ready ? "Not ready after all" : "I'm ready"}
        </button>

        {everyoneReady && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="text-center text-sm font-black uppercase tracking-widest text-good mt-3">
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
