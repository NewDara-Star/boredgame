import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/app/providers/AuthProvider";
import { createRoom } from "@/features/rooms/useRoom";
import type { GameDef } from "./registry";
import { CHALLENGES, readWith, writeWith, type Challenge } from "@/features/challenge/kinds";

/**
 * A game's sheet (#14, and "Play it with" from the Play It With drawings):
 * tapping a game on Games or Home opens this instead of dropping you straight
 * into a bot game. Play it now, or start a room for a person, with how to play
 * one tap away.
 */
export function GameSheet({ g, onClose }: { g: GameDef; onClose: () => void }) {
  const { user, profile } = useAuth();
  const nav = useNavigate();
  const [how, setHow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  // "Play it with…" (#14): what a spot costs, remembered per game.
  const [w, setW] = useState<Challenge>(() => (g.withs ? readWith(g.slug) : "none"));
  const choose = (c: Challenge) => { setW(c); writeWith(g.slug, c); };
  // A room plays every choice (rooms slice 2): the room opens set to it.
  const preset = g.slug;
  const friend = async () => {
    if (!user) { nav("/rooms"); return; }                 // signed out: Rooms asks for a name first
    setBusy(true); setFailed(false);
    const r = await createRoom(user.id, profile?.username ?? "player");
    setBusy(false);
    if (!r) { setFailed(true); return; }
    nav(`/rooms/${r.code}`, { state: { preset, with: g.withs ? w : undefined } });
  };
  return (
    <div className="fixed inset-0 z-50 grid items-end" role="dialog" aria-modal="true" aria-label={g.name}>
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-ink-day/55" />
      <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        className="relative bg-board rounded-t-[26px] px-4 pt-[14px] pb-[calc(18px+env(safe-area-inset-bottom))] max-w-3xl w-full mx-auto grid gap-[10px] shadow-[0_-10px_30px_rgba(14,74,176,.25)]">
        <div className="w-10 h-[5px] rounded-full bg-hair mx-auto" />
        <div className="flex items-center gap-3">
          <g.Art size={64} />
          <div className="min-w-0">
            <p className="font-display text-[24px] leading-tight">{g.name}</p>
            <p className="text-[14px] font-semibold text-soft">{g.tagline}</p>
          </div>
        </div>
        {g.withs && (
          <div className="grid gap-1.5">
            <span className="text-[12px] font-extrabold text-soft">Play it with</span>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Play it with">
              {CHALLENGES.map((c) => (
                <button key={c.key} aria-pressed={w === c.key} onClick={() => choose(c.key)}
                  className="min-h-[44px] -my-[7px] grid place-items-center">
                  <span className={`chip rounded-full px-[11px] py-[5px] text-[13px] font-extrabold text-ink ${w === c.key ? "bg-petal" : "bg-board"}`}>{c.name}</span>
                </button>
              ))}
            </div>
            <p className="text-[13px] font-semibold text-soft">{CHALLENGES.find((c) => c.key === w)?.says}</p>
          </div>
        )}
        <div className={`grid gap-2 ${g.room ? "grid-cols-2" : ""}`}>
          <Link to={g.withs ? `${g.path}?with=${w}` : g.path} className="cut tap cut-petal min-h-[52px] grid place-items-center font-display text-[17px]">
            {g.solo === "bot" ? "Play the bot" : "Play"}
          </Link>
          {g.room && (
            <button onClick={() => void friend()} disabled={busy}
              className="cut tap cut-leaf min-h-[52px] grid place-items-center font-display text-[17px]">
              {busy ? "Opening a room…" : "Play a friend"}
            </button>
          )}
        </div>
        {failed && <p className="text-[13px] font-bold text-ember">Couldn't open a room. Try again.</p>}
        {how ? <p className="text-[14px] font-semibold">{g.howTo}</p> : (
          <button onClick={() => setHow(true)} className="block mx-auto text-[13px] font-black underline underline-offset-4 min-h-[44px]">
            How to play
          </button>
        )}
      </motion.div>
    </div>
  );
}
