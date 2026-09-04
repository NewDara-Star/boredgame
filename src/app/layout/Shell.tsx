import { NavLink, Outlet, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/app/providers/AuthProvider";

const TABS = [
  { to: "/picto", label: "Picto" },
  { to: "/trivia", label: "Trivia" },
  { to: "/rooms", label: "Rooms" },
];

export function Shell() {
  const { offline, user } = useAuth();
  const { pathname } = useLocation();

  return (
    <div className="min-h-full flex flex-col">
      <header className="sticky top-0 z-30 bg-paper/90 backdrop-blur border-b-[2.5px] border-ink">
        <nav className="max-w-3xl mx-auto flex items-center gap-0.5 sm:gap-1 px-3 h-[62px]">
          <NavLink to="/" className="font-display text-lg sm:text-xl font-semibold mr-1 sm:mr-2 shrink-0">
            Bored<span className="text-picto">Game</span>
          </NavLink>
          {TABS.map((t) => {
            const active = pathname.startsWith(t.to);
            return (
              <NavLink key={t.to} to={t.to}
                className="relative px-2.5 sm:px-3 py-1.5 text-sm font-bold rounded-xl shrink-0">
                {active && (
                  // One shared pill that slides between tabs, rather than each
                  // tab fading its own background in and out.
                  <motion.span layoutId="tab-pill"
                    className="absolute inset-0 bg-ink rounded-xl"
                    transition={{ type: "spring", stiffness: 420, damping: 32 }} />
                )}
                <span className={`relative ${active ? "text-paper" : "text-soft"}`}>{t.label}</span>
              </NavLink>
            );
          })}
          <div className="flex-1" />
          <NavLink to="/profile"
            className="text-sm font-bold text-soft hover:text-ink transition-colors shrink-0">
            {user ? "Profile" : "Sign in"}
          </NavLink>
        </nav>
      </header>

      {offline && (
        <div className="bg-pop border-b-[2.5px] border-ink text-ink text-xs font-bold px-4 py-2 text-center">
          Playing on bundled puzzles — add Supabase keys for accounts, sync and head-to-head.
        </div>
      )}

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
