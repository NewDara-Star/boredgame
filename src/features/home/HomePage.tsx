import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/app/providers/AuthProvider";
import { GAMES, type GameDef } from "@/features/play/registry";
import { GameSheet } from "@/features/play/GameSheet";
import { useProgress } from "@/features/play/useProgress";
import { readCarry } from "@/features/play/carry";
import { rankFor } from "@/features/play/rank";
import { today } from "@/features/play/streak";
import { useDailyStatus } from "@/features/daily/useDaily";
import { readGrid } from "@/features/daily/grid";
import { useFriends, type Invite } from "@/features/friends/useFriends";
import { createRoom } from "@/features/rooms/useRoom";
import { Avatar } from "@/shared/ui/Avatar";
import { Sunflower } from "@/shared/brand/Sunflower";
import { HomeTitle, TextPill } from "@/app/layout/ScreenTitle";
import { stagger, riseIn, popIn } from "@/shared/ui/motion";

/**
 * Home (#8–#11), from the drawings' code. One thing leads, picked by what
 * matters now: an invite someone is waiting on, then your streak (on the line,
 * or safe), then today's round. Under it, as drawn (Daramola 26 Sep): not
 * played yet, the people you play with; played, or new, the games to play
 * again, as one swipe row that ends in "See more games". The greeting, week
 * strip and stat tiles stay gone (H4); the numbers live on You.
 */

/** The four games Home shows first (#8, #10). No bank counts (F23). */
const FEATURED = ["tictactoe", "trivia", "memory", "connect4"];
const featured = FEATURED.map((s) => GAMES.find((g) => g.slug === s)).filter((g): g is GameDef => !!g);

/** .card: white, 20px round, the small lift, 14px in. */
const CARD = "card shadow-lift-sm rounded-[20px] p-3.5 grid gap-2 text-ink";

/** The games as a swipe row (Daramola 26 Sep): the drawing's .tile (white,
    18px round, 10px in, icon 44, name 700 14px), two and a sliver on screen so it
    reads as more to the side, and "See more games" last. Tapping one opens its
    sheet (#14), the same as on Games. */
function GamesRow({ title }: { title: string }) {
  const [open, setOpen] = useState<GameDef | null>(null);
  const tile = "card shadow-lift-sm rounded-[18px] p-2.5 flex items-center gap-[9px] min-h-[62px] snap-start shrink-0 w-[168px] text-left";
  return (
    <motion.section variants={riseIn} className="grid gap-[11px]" aria-label={title}>
      <div className="flex items-center gap-2.5">
        <h2 className="font-display text-[20px] leading-none">{title}</h2>
        <span className="flex-1" />
        <Link to="/play" className="text-[13px] font-extrabold text-soft underline underline-offset-4 min-h-[44px] -my-3 grid place-items-center">
          All {GAMES.filter((g) => !g.hidden).length}
        </Link>
      </div>
      <div className="no-scrollbar -mx-[14px] px-[14px] -my-3 py-3 flex gap-[9px] overflow-x-auto snap-x snap-mandatory scroll-px-[14px]">
        {featured.map((g) => (
          <button key={g.slug} onClick={() => setOpen(g)} className={`${tile} tap`}>
            <g.Art size={44} />
            <span className="text-[14px] font-bold leading-[1.2]">{g.name}</span>
          </button>
        ))}
        <Link to="/play" className={`${tile} tap justify-center`}>
          <span className="text-[14px] font-bold leading-[1.2]">See more games</span>
          <svg viewBox="0 0 16 16" width={16} height={16} aria-hidden className="shrink-0">
            <path d="M5 2l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      </div>
      {open && <GameSheet g={open} onClose={() => setOpen(null)} />}
    </motion.section>
  );
}

/** Someone is waiting in a room for you (#11): it beats everything else. The
    gold .turn banner with the flower looking their way, then Join / Not now. */
function InviteHero({ i, onJoin, onLater }: { i: Invite; onJoin: () => void; onLater: () => void }) {
  const game = GAMES.find((g) => g.room?.mode === i.mode)?.name ?? "a game";
  const code = i.room_code.length === 6 ? `${i.room_code.slice(0, 3)} ${i.room_code.slice(3)}` : i.room_code;
  return (
    <motion.section variants={popIn} className="grid gap-[11px]">
      <div className="card flex items-center gap-2.5 rounded-[20px] py-2 pl-2 pr-3.5 shadow-lift-sm text-ink"
        style={{ background: "linear-gradient(var(--color-petal-hi), var(--color-petal))" }}>
        <Sunflower state="look-right" stem={false} size={52} className="shrink-0" />
        <div className="min-w-0 flex-1">
          <b className="block font-display font-normal text-[22px] leading-[1.05] truncate">{i.from_name}'s waiting</b>
          <span className="text-[14px] font-bold">{game} · room <span className="font-mono">{code}</span></span>
        </div>
      </div>
      <div className="grid grid-cols-[1.35fr_1fr] gap-[9px]">
        <button onClick={onJoin} className="cut tap cut-leaf min-h-[52px] font-display text-[19px]">Join {i.from_name}</button>
        <button onClick={onLater} className="cut tap cut-board min-h-[52px] font-display text-[19px]">Not now</button>
      </div>
    </motion.section>
  );
}

/** The flower and one line about your day, on a card (#8, #9, #10). */
function Hero({ state, flower, title, size, line, children }:
  { state: "bored" | "awake"; flower: number; title: string; size: number; line: string; children?: React.ReactNode }) {
  return (
    <motion.section variants={riseIn} className={CARD}>
      <div className="flex items-center gap-2.5">
        <Sunflower state={state} size={flower} className="shrink-0" />
        <div className="min-w-0 flex-1">
          <b className="block font-display font-normal leading-normal" style={{ fontSize: size }}>{title}</b>
          <p className="text-[14px] font-semibold text-soft">{line}</p>
        </div>
      </div>
      {children}
    </motion.section>
  );
}

/** Ten seeds in a card (.card .seeds): 15px, 5px apart, mist until played;
    green right, red wrong, gold answered in a round not finished. */
function DaySeeds({ grid, answered }: { grid: boolean[]; answered: number }) {
  const right = grid.filter(Boolean).length;
  return (
    <div className="flex items-center gap-[5px]" role="img"
      aria-label={grid.length ? `${right} of ${grid.length} right` : answered ? `${answered} of 10 answered` : "Ten questions to play"}>
      {Array.from({ length: 10 }, (_, k) => {
        const ramp = k < grid.length ? (grid[k] ? "leaf" : "ember") : k < answered ? "petal" : null;
        return <i key={k} className="block w-[15px] h-[15px] rounded-full" style={ramp ? {
          background: `radial-gradient(circle at 35% 30%, var(--color-${ramp}-hi), var(--color-${ramp}) 65%)`,
          boxShadow: "0 0 0 2px var(--color-ink-day)",
        } : { background: "var(--color-mist)" }} />;
      })}
    </div>
  );
}

function DailyCard() {
  const d = useDailyStatus();
  const n = Math.max(d.players, d.faces.length);
  const played = d.played !== null;
  const grid = readGrid(today()) ?? [];
  const ordinal = (k: number) => `${k}${k % 100 >= 11 && k % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][k % 10] ?? "th"}`;
  const faces = (
    <div className="flex items-center">
      <div className="flex">
        {d.faces.slice(0, 3).map((f) => <Avatar key={f.user_id} id={f.user_id} name={f.username} size={26} className="-mr-2" />)}
      </div>
      {/* Never claim nobody has played while showing their faces. */}
      <span className="text-[14px] font-semibold text-soft" style={{ marginLeft: d.faces.length ? 20 : 0 }}>
        {n === 0 ? "Nobody yet. Be first." : n === 1 ? "1 has played" : `${n} have played`}
      </span>
    </div>
  );
  if (played) return (
    // #10: .card.tight: the score and your place, The board, then the seeds.
    <motion.section variants={popIn} className="card shadow-lift-sm rounded-[20px] px-3 py-2.5 grid gap-2 text-ink">
      <div className="flex items-center gap-2.5">
        <div className="min-w-0 flex-1">
          <b className="block text-[15px] leading-tight">Today's round: {d.played}/10</b>
          <small className="block text-[12px] font-semibold text-soft">{d.place ? `${ordinal(d.place)} of ${n} so far` : `${n} have played`}</small>
        </div>
        <Link to="/daily" className="cut tap cut-board min-h-[42px] px-3 grid place-items-center font-display text-[16px]"
          style={{ boxShadow: "inset 0 5px 0 var(--h), inset 5px 0 0 var(--h), inset -5px 0 0 var(--l), inset 0 -6px 0 var(--d)" }}>The board</Link>
      </div>
      {grid.length > 0 && <DaySeeds grid={grid} answered={0} />}
    </motion.section>
  );
  return (
    // #9, #11: the title, the line, ten seeds, who's played, then Play.
    <motion.section variants={popIn} className={CARD}>
      <div>
        <h2 className="font-display text-[22px] leading-[1.1]">{d.progress > 0 ? "Finish today's round" : "Today's round"}</h2>
        <p className="text-[14px] font-semibold text-soft">
          {d.progress > 0 ? `${d.progress} of 10 answered. They already count; the board takes all ten.`
            : "Ten questions, the same for everyone. One go."}
        </p>
      </div>
      <DaySeeds grid={d.progress > 0 ? grid.slice(0, d.progress) : []} answered={d.progress} />
      {faces}
      <Link to="/daily" className="cut tap cut-petal min-h-[52px] grid place-items-center font-display text-[19px]">
        {d.progress > 0 ? "Carry on" : "Play"}
      </Link>
    </motion.section>
  );
}

/** #9: the people you play with, one row: their faces, "Play Tobi or Mo",
    and Start a room (a small sky button that opens one). */
function PlaySomeone({ people }: { people: { id: string; username: string }[] }) {
  const { user, profile } = useAuth();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const two = people.slice(0, 2);
  const who = two.length === 0 ? "Play someone" : `Play ${two.map((p) => p.username).join(" or ")}`;
  const start = async () => {
    if (!user || busy) return;
    setBusy(true); setFailed(false);
    const r = await createRoom(user.id, profile?.username ?? "player");
    setBusy(false);
    if (r) nav(`/rooms/${r.code}`); else setFailed(true);
  };
  return (
    <motion.section variants={riseIn} className="card shadow-lift-sm rounded-[20px] px-3 py-2.5 grid gap-1 text-ink">
      <div className="flex items-center gap-2.5">
        <Link to="/rooms" className="min-w-0 flex-1 flex items-center min-h-[44px]">
          {two.length > 0 && (
            <span className="flex shrink-0 mr-4">
              {two.map((p) => <Avatar key={p.id} id={p.id} name={p.username} size={26} className="-mr-2" />)}
            </span>
          )}
          <b className="text-[15px] leading-tight truncate">{who}</b>
        </Link>
        <button onClick={() => void start()} disabled={busy}
          className="cut tap cut-sky min-h-[42px] px-3 font-display text-[16px] shrink-0"
          style={{ boxShadow: "inset 0 5px 0 var(--h), inset 5px 0 0 var(--h), inset -5px 0 0 var(--l), inset 0 -6px 0 var(--d)" }}>
          {busy ? "Opening…" : "Start a room"}
        </button>
      </div>
      {failed && <p className="text-[13px] font-bold text-ember-lo">Couldn't open a room. Try again.</p>}
    </motion.section>
  );
}

/** #8's ink card at the foot: for someone signed out, or a guest (F13). */
function KeepCard({ title, line }: { title: string; line: string }) {
  return (
    <motion.div variants={popIn}>
      <Link to="/you" className="card tap block rounded-[20px] px-3 py-2.5 shadow-lift-sm bg-ink-day">
        <b className="block text-[15px] text-board">{title}</b>
        <span className="block text-[13px] font-normal text-board/80">{line}</span>
      </Link>
    </motion.div>
  );
}

export function HomePage() {
  const { user, offline, isGuest } = useAuth();
  const p = useProgress();
  const nav = useNavigate();
  const { friends, invites, respond } = useFriends();
  // What an account made now would take with it (F17), not the phone's lifetime tally.
  const kept = user ? 0 : readCarry().rows.length;
  const { next } = rankFor(p.answered);
  const waiting = invites[0];
  const fresh = p.answered === 0;
  const days = (k: number) => `${k} day${k === 1 ? "" : "s"}`;

  return (
    <motion.div variants={stagger(0.07)} initial="hidden" animate="show" className="grid gap-[11px] pb-4">
      <HomeTitle end={user || offline ? undefined : <TextPill to="/you">Sign in</TextPill>} />

      {waiting && (
        <InviteHero i={waiting}
          onJoin={() => { void respond(waiting.id, true).then(() => nav(`/rooms/${waiting.room_code}`)); }}
          onLater={() => void respond(waiting.id, false)} />
      )}

      {!waiting && (fresh ? (
        <Hero state="bored" flower={70} size={22} title="I'm so bored." line="Ten quick questions? Takes two minutes.">
          <Link to="/trivia" className="cut tap cut-petal min-h-[52px] grid place-items-center font-display text-[19px]">
            Play Star Trivia
          </Link>
        </Hero>
      ) : !p.playedToday ? (
        <Hero state="bored" flower={62} size={21}
          title={p.streak > 0 ? `${days(p.streak)} in a row` : "Nothing yet today"}
          line={p.streak > 0 ? `Play anything today to make it ${p.streak + 1}.` : "Play anything today to start a streak."} />
      ) : (
        <Hero state="awake" flower={62} size={21}
          title={`${days(p.streak)}. Safe till tomorrow.`}
          line={next ? `${next.min - p.answered} more question${next.min - p.answered === 1 ? "" : "s"} to ${next.name}.` : "Top of the road. Nobody's past you."} />
      ))}

      {/* Today's round is for players with a name; signed out, Daily says how to get one. */}
      {user && !offline && <DailyCard />}

      {/* Not played yet: the people you play with (#9). Played, or new: the
          games (#8, #10). An invite leads on its own (#11). */}
      {!waiting && user && !fresh && !p.playedToday && <PlaySomeone people={friends} />}
      {!waiting && (fresh || p.playedToday) && <GamesRow title={fresh ? "Games" : "Play again"} />}

      {!user && !offline && (
        <KeepCard title={kept > 0 ? `${kept} answer${kept === 1 ? "" : "s"} on this phone` : "Playing signed out"}
          line={kept > 0 ? "Make an account and they come with you, with up to 7 days of streak."
            : "Pick a name to keep your streak and play the daily."} />
      )}

      {/* A guest's games go 30 days after they last play (F11). Home says so
          once, and where to keep them (F13). */}
      {isGuest && !offline && (
        <KeepCard title="Playing as a guest" line="Add a password to keep your streak for good and get on the leaderboard." />
      )}
    </motion.div>
  );
}
