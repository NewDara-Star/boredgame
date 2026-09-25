import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/app/providers/AuthProvider";
import { createRoom } from "@/features/rooms/useRoom";
import { Sunflower } from "@/shared/brand/Sunflower";
import { stagger, riseIn } from "@/shared/ui/motion";
import type { Family } from "@/shared/brand/tokens";
import { useLiveBanks } from "./counts";
import { GAMES, type GameDef } from "./registry";

/**
 * Games (#12–#14): grouped by family, one line each, no bank counts. Tapping a
 * game opens a sheet (#14) instead of dropping you straight into a bot game:
 * play it now, or start a room for a person, with how to play one tap away.
 */
const FAMILY_NAMES: [Family, string][] = [["quiz", "Quiz"], ["board", "Board"], ["puzzle", "Puzzle"], ["skill", "Skill"], ["party", "Party"]];

/** A whole word or phrase inside the search: "aim" doesn't find "claim". */
const says = (needle: string, w: string) => ` ${needle} `.includes(` ${w} `);

/** Search by name, what it's about, or its other names (#13). Games it's only
 *  like don't count: a search for chess shouldn't list Tic Tac Toe as chess. */
function matches(g: GameDef, needle: string) {
  return `${g.name} ${g.tagline} ${g.badge}`.toLowerCase().includes(needle)
    || g.alsoKnown.some((w) => w.startsWith(needle) || says(needle, w));
}

/** Nothing matched: the nearest thing by what it's like, or Star Trivia. */
function nearest(needle: string): GameDef {
  return GAMES.find((g) => g.like.some((w) => w.startsWith(needle) || says(needle, w)))
    ?? GAMES.find((g) => g.slug === "trivia") ?? GAMES[0];
}

function Sheet({ g, onClose }: { g: GameDef; onClose: () => void }) {
  const { user, profile } = useAuth();
  const nav = useNavigate();
  const [how, setHow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const friend = async () => {
    if (!user) { nav("/rooms"); return; }                 // signed out: Rooms asks for a name first
    setBusy(true); setFailed(false);
    const r = await createRoom(user.id, profile?.username ?? "player");
    setBusy(false);
    if (!r) { setFailed(true); return; }
    nav(`/rooms/${r.code}`, { state: { preset: g.slug } });
  };
  return (
    <div className="fixed inset-0 z-50 grid items-end" role="dialog" aria-modal="true" aria-label={g.name}>
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-ink/50" />
      <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        className="relative bg-board rounded-t-[26px] px-4 pt-3 pb-[calc(18px+env(safe-area-inset-bottom))] max-w-3xl w-full mx-auto space-y-3">
        <div className="w-10 h-1.5 rounded-full bg-mist mx-auto" />
        <div className="flex items-center gap-3">
          <g.Art size={64} />
          <div className="min-w-0">
            <p className="font-display text-[24px] leading-tight font-semibold">{g.name}</p>
            <p className="text-[14px] font-semibold text-soft">{g.tagline}</p>
          </div>
        </div>
        <div className={`grid gap-2 ${g.room ? "grid-cols-2" : ""}`}>
          <Link to={g.path} className="cut tap cut-petal min-h-[52px] grid place-items-center font-display text-[17px]">
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

export function CataloguePage() {
  const live = useLiveBanks();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<GameDef | null>(null);
  const needle = q.trim().toLowerCase();
  const shown = useMemo(() => (needle ? GAMES.filter((g) => matches(g, needle)) : GAMES), [needle]);
  const playable = (g: GameDef) => !g.bank || live[g.bank as keyof typeof live] !== false;
  const near = shown.length === 0 && needle ? nearest(needle) : null;

  return (
    <motion.div variants={stagger(0.06)} initial="hidden" animate="show" className="pb-6">
      <motion.h1 variants={riseIn} className="font-display text-[34px] leading-none font-semibold">Games</motion.h1>
      <motion.input variants={riseIn} value={q} onChange={(e) => setQ(e.target.value)}
        placeholder="Search games" type="search" aria-label="Search games"
        className="w-full mt-4 bg-board shadow-lift-sm rounded-2xl px-4 py-3 font-bold text-ink placeholder:text-soft/60 outline-none
          focus:shadow-[0_5px_0_var(--color-ink)] transition-shadow" />

      {near ? (
        <motion.div variants={riseIn} className="card p-5 mt-5 flex items-center gap-4">
          <Sunflower state="look-left" size={72} className="shrink-0" />
          <div className="min-w-0">
            <p className="font-display text-[22px] leading-tight font-semibold">No {q.trim()} yet</p>
            <p className="text-[14px] font-semibold mt-1">The nearest thing is {near.name}.</p>
            <button onClick={() => setOpen(near)}
              className="cut tap cut-petal mt-3 px-4 min-h-[44px] font-display text-[16px]">Play {near.name}</button>
          </div>
        </motion.div>
      ) : (
        FAMILY_NAMES.map(([fam, label]) => {
          const games = shown.filter((g) => g.family === fam);
          if (games.length === 0) return null;
          return (
            <motion.section key={fam} variants={riseIn} className="mt-6">
              <h2 className="font-display text-[21px] font-semibold mb-2.5">{label}</h2>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {games.map((g) => {
                  const ok = playable(g);
                  return (
                    <button key={g.slug} onClick={() => ok && setOpen(g)} disabled={!ok}
                      className={`card ${ok ? "tap" : "opacity-55"} p-3 flex items-center gap-3 text-left w-full min-w-0`}>
                      <g.Art size={64} />
                      <span className="min-w-0 flex-1">
                        <span className="block font-display text-[19px] leading-tight font-semibold">{g.name}</span>
                        <span className="block text-[13px] font-semibold text-soft line-clamp-2">{ok ? g.tagline : "Nothing live yet"}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </motion.section>
          );
        })
      )}

      {open && <Sheet g={open} onClose={() => setOpen(null)} />}
    </motion.div>
  );
}
