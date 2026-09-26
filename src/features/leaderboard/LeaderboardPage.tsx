import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/app/providers/AuthProvider";
import { Avatar } from "@/shared/ui/Avatar";
import { SPRING, stagger, riseIn } from "@/shared/ui/motion";
import { SubTitle } from "@/app/layout/ScreenTitle";
import { rankFor } from "@/features/play/rank";
import { RankBadge } from "@/features/play/RankBadge";
import { useLeaderboard, type Standing } from "./useLeaderboard";

/**
 * #49, from the drawing's code: the top three in one white card, 2nd, 1st,
 * 3rd (a face, the name, their rank's flower, the count in mono), then the
 * rest as plain rows (.li). Nothing here is a button, so nothing looks like
 * one (R8).
 */
const PODIUM_ORDER = [1, 0, 2];

function Podium({ top, meId }: { top: Standing[]; meId?: string }) {
  return (
    <motion.div variants={riseIn}
      className="card shadow-lift-sm rounded-[20px] p-3.5 grid grid-cols-[1fr_1.15fr_1fr] items-end text-center gap-1.5 text-ink">
      {PODIUM_ORDER.map((i) => {
        const p = top[i];
        if (!p) return <span key={i} />;
        const first = i === 0;
        return (
          <div key={p.id} className="grid justify-items-center min-w-0">
            <Avatar id={p.id} name={p.username} size={first ? 52 : 34} tone={p.id === meId ? "petal" : undefined} />
            <b className={`block max-w-full truncate ${first ? "text-[15px]" : "text-[13px]"}`}>{p.id === meId ? "You" : p.username}</b>
            <RankBadge rank={rankFor(p.answered).current.key} size={first ? 38 : i === 1 ? 30 : 28} />
            <small className="block font-mono text-[12px] tabular-nums">{p.answered.toLocaleString()}</small>
          </div>
        );
      })}
    </motion.div>
  );
}

function Row({ p, meId }: { p: Standing; meId?: string }) {
  const me = p.id === meId;
  const rank = rankFor(p.answered).current;
  return (
    <div className={`card shadow-lift-sm rounded-[16px] px-3 py-[9px] flex items-center gap-2.5 text-ink ${me ? "bg-petal" : ""}`}>
      <Avatar id={p.id} name={p.username} size={26} tone={me ? "petal" : undefined} />
      <span className="min-w-0 flex-1">
        <b className="block text-[15px] leading-[1.2] truncate tabular-nums">{p.position}{" "}{me ? "You" : p.username}</b>
        <small className={`block text-[12px] font-semibold tabular-nums ${me ? "" : "text-soft"}`}>
          {p.answered.toLocaleString()} answered{p.answered > 0 && `, ${Math.round((p.correct / p.answered) * 100)}% right`}
        </small>
      </span>
      <RankBadge rank={rank.key} size={28} className="shrink-0" />
    </div>
  );
}

/** Your row, held at the foot of the screen when the page doesn't reach you (#49). */
function StickyBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-[calc(62px+env(safe-area-inset-bottom))] sm:bottom-0 z-20 px-[14px] pb-[14px] pointer-events-none">
      <div className="max-w-3xl mx-auto pointer-events-auto">{children}</div>
    </div>
  );
}

export function LeaderboardPage() {
  const { user, offline, isGuest } = useAuth();
  // Guests are left off the board (useLeaderboard filters is_guest), so they
  // have no place on it. Asking for theirs used to produce one anyway, counted
  // against members only: a "14 You" row for someone the board never shows.
  const { rows, you, loading, failed, retry } = useLeaderboard(isGuest ? undefined : user?.id);

  if (offline) {
    return (
      <div className="card p-6">
        <h1 className="font-display text-2xl">Leaderboard</h1>
        <p className="text-sm text-soft font-semibold mt-2">
          There is no backend configured, so there is nobody to rank. Add Supabase keys and it fills in.
        </p>
      </div>
    );
  }

  const top = rows.slice(0, 3);
  const rest = rows.length >= 3 ? rows.slice(3) : rows;
  const youOnPage = !!you && rows.some((r) => r.id === you.id);

  return (
    <motion.div variants={stagger(0.07)} initial="hidden" animate="show" className="grid gap-[11px] pb-24">
      <SubTitle back="/you" backLabel="Back to You">Everyone</SubTitle>

      {loading ? (
        <div className="grid gap-2">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="card h-[46px] animate-pulse opacity-40" />
          ))}
        </div>
      ) : failed ? (
        <div className="card shadow-lift-sm p-5 grid gap-2 justify-items-center text-center text-ink">
          <h2 className="font-display text-[22px] leading-[1.1]">Couldn't load the board</h2>
          <p className="text-[14px] text-soft font-semibold">Check your signal and try again.</p>
          <button onClick={retry} className="cut tap w-full min-h-[52px] cut-petal font-display text-[19px]">Try again</button>
        </div>
      ) : rows.length === 0 ? (
        <div className="card shadow-lift-sm p-5 grid gap-2 justify-items-center text-center text-ink">
          <h2 className="font-display text-[22px] leading-[1.1]">Nobody has played yet.</h2>
          <p className="text-[14px] text-soft font-semibold">Answer one question and the top spot is yours.</p>
          <Link to="/trivia" className="cut tap w-full min-h-[52px] grid place-items-center cut-petal font-display text-[19px]">Start a round</Link>
        </div>
      ) : (
        <>
          {rows.length >= 3 && <Podium top={top} meId={user?.id} />}
          <div className="grid gap-2">
            {rest.map((p, i) => (
              <motion.div key={p.id}
                initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
                transition={{ ...SPRING, delay: 0.2 + i * 0.035 }}>
                <Row p={p} meId={user?.id} />
              </motion.div>
            ))}
          </div>
        </>
      )}

      {/* Being 214th is still information. Without this row the page just stops
          before it reaches you, which reads as "you are not on here". */}
      {!loading && you && !youOnPage && (
        <StickyBar><Row p={you} meId={user?.id} /></StickyBar>
      )}
      {!loading && isGuest && rows.length > 0 && (
        <StickyBar>
          <Link to="/you" className="cut tap block cut-petal px-4 py-3 text-center font-display text-[17px]">
            Guests aren't on the board. Save your progress to join it
          </Link>
        </StickyBar>
      )}
      {!loading && !user && rows.length > 0 && (
        <StickyBar>
          <Link to="/you" className="cut tap block cut-petal px-4 py-3 text-center font-display text-[17px]">
            Sign in to take a place on this list
          </Link>
        </StickyBar>
      )}
    </motion.div>
  );
}
