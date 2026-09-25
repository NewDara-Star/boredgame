import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/app/providers/AuthProvider";
import { GAMES } from "@/features/play/registry";
import { useProgress } from "@/features/play/useProgress";
import { readCarry } from "@/features/play/carry";
import { rankFor } from "@/features/play/rank";
import { useDailyStatus } from "@/features/daily/useDaily";
import { useFriends, type Invite } from "@/features/friends/useFriends";
import { Avatar } from "@/shared/ui/Avatar";
import { Sunflower } from "@/shared/brand/Sunflower";
import { IconFlame } from "@/app/layout/Icons";
import { stagger, riseIn, popIn } from "@/shared/ui/motion";

/**
 * Home, redrawn (#8–#11, H4). One thing leads, picked by what matters now: an
 * invite someone is waiting on, then your streak (on the line, or safe), and
 * today's round. The greeting, week strip and stat tiles are gone: for a new
 * player they were all zeros, and the numbers live on You now.
 */

/** The four games Home shows, then All (drawings #8, #10). No bank counts (F23). */
const FEATURED = ["tictactoe", "trivia", "memory", "connect4"];

function Section({ title, to, cta, children }: { title: string; to?: string; cta?: string; children: React.ReactNode }) {
  return (
    <motion.section variants={riseIn} className="mt-6">
      <div className="flex items-baseline justify-between mb-2.5">
        <h2 className="font-display text-[21px] font-semibold">{title}</h2>
        {to && <Link to={to} className="text-[13px] font-black underline underline-offset-4 py-2">{cta}</Link>}
      </div>
      {children}
    </motion.section>
  );
}

function GamesRow() {
  const games = FEATURED.map((s) => GAMES.find((g) => g.slug === s)).filter((g): g is (typeof GAMES)[number] => !!g);
  return (
    <Section title="Games" to="/play" cta={`All ${GAMES.length}`}>
      <div className="grid grid-cols-2 gap-2.5">
        {games.map((g) => (
          <Link key={g.slug} to={g.path} className="card tap flex items-center gap-2.5 p-2.5 min-h-[62px]">
            <g.Art size={44} />
            <span className="font-bold text-[14px] leading-tight">{g.name}</span>
          </Link>
        ))}
      </div>
    </Section>
  );
}

/** Someone is waiting in a room for you (#11): it beats everything else. */
function InviteHero({ i, onJoin, onLater }: { i: Invite; onJoin: () => void; onLater: () => void }) {
  const game = GAMES.find((g) => g.room?.mode === i.mode)?.name ?? "a game";
  const code = i.room_code.length === 6 ? `${i.room_code.slice(0, 3)} ${i.room_code.slice(3)}` : i.room_code;
  return (
    <motion.section variants={popIn} className="card p-4 flex items-center gap-3">
      <Sunflower state="look-right" stem={false} size={64} />
      <div className="min-w-0 flex-1">
        <p className="font-display text-[22px] leading-tight font-semibold truncate">{i.from_name}'s waiting</p>
        <p className="text-[13px] font-bold text-soft">{game} · room <span className="font-mono">{code}</span></p>
        <div className="grid grid-cols-[1.4fr_1fr] gap-2 mt-3">
          <button onClick={onJoin} className="cut tap cut-leaf min-h-[44px] font-display text-[16px]">Join {i.from_name}</button>
          <button onClick={onLater} className="cut tap cut-board min-h-[44px] font-display text-[16px]">Not now</button>
        </div>
      </div>
    </motion.section>
  );
}

/** The flower and one line about your day (#8, #9, #10). */
function Hero({ state, title, line, children }: { state: "bored" | "awake"; title: string; line: string; children?: React.ReactNode }) {
  return (
    <motion.section variants={riseIn} className="flex items-center gap-3">
      <Sunflower state={state} size={92} className="shrink-0 -mb-2" />
      <div className="min-w-0 flex-1">
        <p className="font-display text-[26px] leading-[1.05] font-semibold">{title}</p>
        <p className="text-[14px] font-bold mt-1.5">{line}</p>
        {children}
      </div>
    </motion.section>
  );
}

function Flame({ n }: { n: number }) {
  return (
    <span className="inline-flex items-center gap-1 mt-2 chip bg-board px-2.5 py-1 text-[13px] font-black tabular-nums"
      aria-label={`${n}-day streak`}>
      <IconFlame /> {n}
    </span>
  );
}

function DailyCard() {
  const d = useDailyStatus();
  const n = Math.max(d.players, d.faces.length);
  const played = d.played !== null;
  const ordinal = (k: number) => `${k}${k % 100 >= 11 && k % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][k % 10] ?? "th"}`;
  return (
    <motion.div variants={popIn} className="mt-5">
      <Link to="/daily" className={`cut tap block p-4 ${played ? "cut-board" : "cut-petal"}`}>
        <p className="font-display text-[23px] leading-tight font-semibold">
          {played ? `Today's round: ${d.played}/10` : d.progress > 0 ? "Finish today's round" : "Today's round"}
        </p>
        <p className="text-[13px] font-bold mt-1">
          {played ? (d.place ? `${ordinal(d.place)} of ${n} so far` : `${n} have played`)
            : d.progress > 0 ? `${d.progress} of 10 answered. They already count; the board takes all ten.`
            : "Ten questions, the same for everyone. One go."}
        </p>
        <div className="flex items-center gap-2 mt-3">
          <div className="flex -space-x-2.5">
            {d.faces.slice(0, 3).map((f) => <Avatar key={f.user_id} id={f.user_id} name={f.username} size={28} />)}
          </div>
          {/* Never claim nobody has played while showing their faces. */}
          <span className="text-[12px] font-bold">
            {n === 0 ? "Nobody yet. Be first." : n === 1 ? "1 has played" : `${n} have played`}
          </span>
          <span className="flex-1" />
          <span className="font-display text-[17px]">{played ? "The board →" : d.progress > 0 ? "Carry on →" : "Play →"}</span>
        </div>
      </Link>
    </motion.div>
  );
}

function PlaySomeone({ names }: { names: string[] }) {
  const who = names.length === 0 ? null : names.length === 1 ? names[0] : `${names[0]} or ${names[1]}`;
  return (
    <Section title="Play someone" to="/you/everyone" cta="Leaderboard">
      <div className={`grid gap-2.5 ${who ? "grid-cols-2" : ""}`}>
        {who && <Link to="/rooms" className="cut tap cut-sky min-h-[52px] grid place-items-center px-3 font-display text-[16px] text-center leading-tight">Play {who}</Link>}
        <Link to="/rooms" className="cut tap cut-petal min-h-[52px] grid place-items-center font-display text-[16px]">Start a room</Link>
      </div>
    </Section>
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
  const names = friends.map((f) => f.username).slice(0, 2);

  return (
    <motion.div variants={stagger(0.07)} initial="hidden" animate="show" className="pb-4">
      {waiting && (
        <InviteHero i={waiting}
          onJoin={() => { void respond(waiting.id, true).then(() => nav(`/rooms/${waiting.room_code}`)); }}
          onLater={() => void respond(waiting.id, false)} />
      )}

      {!waiting && (fresh ? (
        <Hero state="bored" title="I'm so bored." line="Ten quick questions? Takes two minutes.">
          <Link to="/trivia" className="cut tap cut-petal inline-grid place-items-center mt-3 px-5 min-h-[48px] font-display text-[17px]">
            Play Star Trivia
          </Link>
        </Hero>
      ) : !p.playedToday ? (
        <Hero state="bored"
          title={p.streak > 0 ? `${p.streak} day${p.streak === 1 ? "" : "s"} in a row` : "Nothing yet today"}
          line={p.streak > 0 ? `Play anything today to make it ${p.streak + 1}.` : "Play anything today to start a streak."}>
          {p.streak > 0 && <Flame n={p.streak} />}
        </Hero>
      ) : (
        <Hero state="awake"
          title={`${p.streak} day${p.streak === 1 ? "" : "s"}. Safe till tomorrow.`}
          line={next ? `${next.min - p.answered} more question${next.min - p.answered === 1 ? "" : "s"} to ${next.name}.` : "Top of the road. Nobody's past you."}>
          {p.streak > 0 && <Flame n={p.streak} />}
        </Hero>
      ))}

      {/* Today's round is for players with a name; signed out, Daily says how to get one. */}
      {user && !offline && <DailyCard />}

      {/* Played today, or new: the games lead (#8, #10). Otherwise they wait
          below the people you play with (#9). */}
      {(fresh || p.playedToday) && <GamesRow />}
      {user && !fresh && <PlaySomeone names={names} />}
      {!fresh && !p.playedToday && <GamesRow />}

      {!user && !offline && (
        <motion.div variants={popIn} className="mt-6">
          <Link to="/you" className="cut tap block cut-ink text-ground p-4">
            <p className="font-display text-lg font-semibold">
              {kept > 0 ? `${kept} answer${kept === 1 ? "" : "s"} on this phone` : "Playing signed out"}
            </p>
            <p className="text-[13px] font-semibold opacity-80 mt-0.5">
              {kept > 0
                ? "Make an account and they come with you, with up to 7 days of streak →"
                : "Pick a name to keep your streak and play the daily →"}
            </p>
          </Link>
        </motion.div>
      )}

      {/* A guest's games go 30 days after they last play (F11). Home says so
          once, and where to keep them (F13). */}
      {isGuest && !offline && (
        <motion.div variants={popIn} className="mt-6">
          <Link to="/you" className="cut tap block cut-ink text-ground p-4">
            <p className="font-display text-lg font-semibold">Playing as a guest</p>
            <p className="text-[13px] font-semibold opacity-80 mt-0.5">
              Add a password to keep your streak for good and get on the leaderboard →
            </p>
          </Link>
        </motion.div>
      )}
    </motion.div>
  );
}
