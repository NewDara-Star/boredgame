import { NavLink, Outlet, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/app/providers/AuthProvider";
import { useProgress } from "@/features/play/useProgress";
import { rankFor } from "@/features/play/rank";
import { RankBadge } from "@/features/play/RankBadge";
import { IconHome, IconPicto, IconTrivia, IconRooms, IconRanks, IconFlame } from "./Icons";

const TABS = [
  { to: "/", label: "Home", exact: true, Icon: IconHome },
  { to: "/picto", label: "Picto", Icon: IconPicto },
  { to: "/trivia", label: "Trivia", Icon: IconTrivia },
  { to: "/rooms", label: "Rooms", Icon: IconRooms },
  { to: "/ranks", label: "Ranks", Icon: IconRanks },
];

const isActive = (pathname: string, to: string, exact?: boolean) =>
  exact ? pathname === to : pathname.startsWith(to);

export function Shell() {
  const { offline, user } = useAuth();
  const { pathname } = useLocation();
  const p = useProgress();
  const rank = rankFor(p.answered).current;

  return (
    <div className="min-h-full flex flex-col">
      <header className="sticky top-0 z-30 bg-paper/90 backdrop-blur border-b-[2.5px] border-ink">
        <nav className="max-w-3xl mx-auto flex items-center gap-1 px-3 h-[62px]">
          <NavLink to="/" className="font-display text-lg sm:text-xl font-semibold mr-1 sm:mr-3 shrink-0">
            Bored<span className="text-picto">Game</span>
          </NavLink>

          {/* Five labelled tabs do not fit a phone, so on small screens they move
              to the bottom bar and the header carries status instead. */}
          <div className="hidden sm:flex items-center gap-1">
            {TABS.slice(1).map((t) => {
              const active = isActive(pathname, t.to, t.exact);
              return (
                <NavLink key={t.to} to={t.to}
                  className="relative px-3 py-1.5 text-sm font-bold rounded-xl shrink-0">
                  {active && (
                    <motion.span layoutId="tab-pill-top"
                      className="absolute inset-0 bg-ink rounded-xl"
                      transition={{ type: "spring", stiffness: 420, damping: 32 }} />
                  )}
                  <span className={`relative ${active ? "text-paper" : "text-soft"}`}>{t.label}</span>
                </NavLink>
              );
            })}
          </div>

          <div className="flex-1" />

          {p.streak > 0 && (
            <motion.span
              initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              className="flex items-center gap-1 bg-pop border-2 border-ink rounded-full
                px-2.5 py-1 text-[11px] font-black tabular-nums shrink-0"
              title={`${p.streak}-day streak`}>
              <IconFlame />
              {p.streak}
            </motion.span>
          )}
          {/* A badge is not a call to action. Signed out, the only thing in the
              header should be the way in — the previous build showed a rank
              badge, which read as "you are already logged in". */}
          {user || offline ? (
            <NavLink to="/profile" aria-label="Profile"
              className="shrink-0 grid place-items-center h-9 w-9 ml-1">
              <RankBadge rank={rank.key} size={30} />
            </NavLink>
          ) : (
            <NavLink to="/profile"
              className="piece press shrink-0 ml-1.5 bg-ink text-paper px-3 py-1.5
                text-[12px] font-black uppercase tracking-wider rounded-xl">
              Sign up
            </NavLink>
          )}
        </nav>
      </header>

      {offline && (
        <div className="bg-pop border-b-[2.5px] border-ink text-ink text-xs font-bold px-4 py-2 text-center">
          Playing on bundled puzzles — add Supabase keys for accounts, sync and head-to-head.
        </div>
      )}

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-6 pb-28 sm:pb-6">
        <Outlet />
      </main>

      <nav className="sm:hidden fixed inset-x-0 bottom-0 z-30 bg-paper/95 backdrop-blur
        border-t-[2.5px] border-ink pb-[env(safe-area-inset-bottom)]">
        <div className="max-w-3xl mx-auto grid grid-cols-5">
          {TABS.map((t) => {
            const active = isActive(pathname, t.to, t.exact);
            return (
              <NavLink key={t.to} to={t.to}
                className="relative grid place-items-center gap-0.5 py-2.5">
                {active && (
                  <motion.span layoutId="tab-pill-bottom"
                    className="absolute inset-x-2 inset-y-1 bg-ink rounded-2xl"
                    transition={{ type: "spring", stiffness: 420, damping: 32 }} />
                )}
                <span className={`relative ${active ? "text-paper" : "text-soft"}`}><t.Icon /></span>
                <span className={`relative text-[10px] font-black uppercase tracking-wide
                  ${active ? "text-paper" : "text-soft"}`}>{t.label}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
