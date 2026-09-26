import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Sunflower } from "@/shared/brand/Sunflower";
import { ScreenTitle } from "@/app/layout/ScreenTitle";
import { stagger, riseIn } from "@/shared/ui/motion";
import type { Family } from "@/shared/brand/tokens";
import { useLiveBanks } from "./counts";
import { GAMES as ALL, type GameDef } from "./registry";
import { GameSheet } from "./GameSheet";

/** The games on the list: Square Off and the catapult and trivia versions are
    Tic Tac Toe and Connect 4 played with a challenge now (Daramola 26 Sep). */
const GAMES = ALL.filter((g) => !g.hidden);

/**
 * Games (#12–#14), from the drawings' code: the title row, the search field
 * (.field), then each family as a chip over two tiles a row (.tiles, .gtile:
 * icon, name, tagline), no bank counts. Tapping a game opens its sheet (#14).
 */
const FAMILY_NAMES: [Family, string][] = [["quiz", "Quiz"], ["board", "Board"], ["puzzle", "Puzzle"], ["skill", "Skill"], ["party", "Party"]];
/** The family chip's colour (.chip.sky, .chip.leaf …): the family's own. */
const FAMILY_CHIP: Record<Family, string> = { quiz: "bg-sky-hi", board: "bg-leaf-hi", puzzle: "bg-grape-hi", skill: "bg-ember-hi", party: "bg-gum-hi" };

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

export function CataloguePage() {
  const live = useLiveBanks();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<GameDef | null>(null);
  const needle = q.trim().toLowerCase();
  const shown = useMemo(() => (needle ? GAMES.filter((g) => matches(g, needle)) : GAMES), [needle]);
  const playable = (g: GameDef) => !g.bank || live[g.bank as keyof typeof live] !== false;
  const near = shown.length === 0 && needle ? nearest(needle) : null;

  return (
    <motion.div variants={stagger(0.06)} initial="hidden" animate="show" className="grid gap-[11px] pb-6">
      <ScreenTitle>Games</ScreenTitle>
      <motion.input variants={riseIn} value={q} onChange={(e) => setQ(e.target.value)}
        placeholder="Search games" type="search" aria-label="Search games"
        className={`w-full bg-board rounded-[14px] px-3.5 py-3 text-[16px] font-semibold text-ink placeholder:text-soft outline-none focus-visible:outline-none
          ${needle ? "shadow-[inset_0_0_0_2.5px_var(--color-sky)]" : "shadow-[inset_0_0_0_2px_var(--color-hair)]"} focus:shadow-[inset_0_0_0_2.5px_var(--color-sky)]`} />

      {near ? (
        // #13: .card.center, 20px in: the flower looking for it, 100px; h3 22px; the button full width.
        <motion.div variants={riseIn} className="card shadow-lift-sm rounded-[20px] p-5 grid gap-2 justify-items-center text-center">
          <Sunflower state="look-left" size={100} />
          <h2 className="font-display text-[22px] leading-[1.1]">No {q.trim()} yet</h2>
          <p className="text-[14px] font-semibold text-soft">The nearest thing is {near.name}.</p>
          <button onClick={() => setOpen(near)}
            className="cut tap cut-petal w-full min-h-[52px] font-display text-[19px]">Play {near.name}</button>
        </motion.div>
      ) : (
        FAMILY_NAMES.map(([fam, label]) => {
          const games = shown.filter((g) => g.family === fam);
          if (games.length === 0) return null;
          return (
            <motion.section key={fam} variants={riseIn} className="grid gap-[11px]" aria-label={label}>
              <h2 className="flex"><span className={`chip shadow-none rounded-full px-[9px] py-0.5 text-[12px] font-extrabold text-ink ${FAMILY_CHIP[fam]}`}>{label}</span></h2>
              <div className="grid grid-cols-2 gap-[9px]">
                {games.map((g) => {
                  const ok = playable(g);
                  return (
                    <button key={g.slug} onClick={() => ok && setOpen(g)} disabled={!ok}
                      className={`card shadow-lift-sm rounded-[20px] p-3 grid gap-1.5 justify-items-start content-start text-left min-w-0 ${ok ? "tap" : "opacity-55"}`}>
                      <g.Art size={64} />
                      <span className="font-display text-[18px] leading-[1.1]">{g.name}</span>
                      <span className="text-[13px] leading-[1.3] font-semibold text-soft line-clamp-2">{ok ? g.tagline : "Nothing live yet"}</span>
                    </button>
                  );
                })}
              </div>
            </motion.section>
          );
        })
      )}

      {open && <GameSheet g={open} onClose={() => setOpen(null)} />}
    </motion.div>
  );
}
