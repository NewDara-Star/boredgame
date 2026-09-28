import { Suspense, useEffect } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { hasLinkError } from "@/shared/lib/linkError";
import { motion } from "framer-motion";
import { useAuth } from "@/app/providers/AuthProvider";
import { IconHome, IconPlay, IconRooms, IconRanks } from "./Icons";
import { Wordmark } from "@/shared/ui/Wordmark";
import { ErrorBoundary } from "@/app/ErrorBoundary";
import { ScreenLoading } from "./ScreenLoading";
import { useFocused } from "./focus";
import { PushOnboarding } from "@/features/push/PushOnboarding";
import { InviteToast } from "@/features/friends/InviteToast";
import { CarryAcross } from "@/features/play/CarryAcross";
import { Sky } from "@/shared/brand/Sky";

// Sections, not games. One tab per game works at three and falls over at six,
// and the catalogue behind /play scales to as many as we ever write.
const TABS = [
  { to: "/", label: "Home", exact: true, Icon: IconHome },
  { to: "/play", label: "Games", Icon: IconPlay },
  { to: "/rooms", label: "Rooms", Icon: IconRooms },
  { to: "/you", label: "You", Icon: IconRanks },
];

const isActive = (pathname: string, to: string, exact?: boolean) =>
  exact ? pathname === to : pathname.startsWith(to);

export function Shell() {
  const { offline, user } = useAuth();
  const { pathname } = useLocation();
  const nav = useNavigate();
  // A failed email link lands wherever it was sent (usually Home); its reason
  // is shown on the You screen, so go there (F14).
  useEffect(() => {
    if (hasLinkError() && pathname !== "/you") nav("/you", { replace: true });
  }, [pathname, nav]);
  // A round in play hides the header and the tab bar (#16); its own X leads out.
  const focused = useFocused();

  return (
    <div className="min-h-full flex flex-col">
      <Sky />
      {/* Phones have no app bar (the drawings, Daramola 26 Sep): each screen
          carries its own title row with the streak pill, and Home the wordmark.
          A laptop keeps a slim bar, because its tabs live there. */}
      {!focused && <header className="hidden sm:block sticky top-0 z-30 bg-board/90 backdrop-blur shadow-lift">
        <nav className="max-w-3xl mx-auto flex items-center gap-1 px-3 h-[62px]">
          <NavLink to="/" className="mr-3 shrink-0 grid place-items-center" aria-label="BoredGame home">
            <Wordmark height={26} />
          </NavLink>
          {TABS.slice(1).map((t) => {
            const active = isActive(pathname, t.to, t.exact);
            return (
              <NavLink key={t.to} to={t.to}
                className="relative px-3 py-1.5 text-sm font-bold rounded-xl shrink-0">
                {active && (
                  <motion.span layoutId="tab-pill-top"
                    className="absolute inset-0 bg-petal rounded-xl"
                    transition={{ type: "spring", stiffness: 420, damping: 32 }} />
                )}
                <span className={`relative ${active ? "text-ink" : "text-soft"}`}>{t.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </header>}

      {offline && (
        <div className="bg-leaf-hi text-ink text-xs font-bold px-4 py-2 text-center">
          Playing on bundled puzzles — add Supabase keys for accounts, sync and head-to-head.
        </div>
      )}

      {/* Clear the 62px bottom bar PLUS the home-indicator safe area: the bar
          is fixed and extends into env(safe-area-inset-bottom), so 5rem alone
          left the last ~30px of content under it on a notched iPhone. --chrome
          in index.css carries the same term, and .play-surface subtracts it. */}
      <main className={`flex-1 max-w-3xl w-full mx-auto px-[14px] sm:py-6 ${focused
        ? "pt-[calc(6px+env(safe-area-inset-top))] pb-[calc(14px+env(safe-area-inset-bottom))]"
        : "pt-[calc(6px+env(safe-area-inset-top))] pb-[calc(5rem+env(safe-area-inset-bottom))]"}`}>
        {/* Keyed on the path so navigating away from a broken screen clears it. */}
        <ErrorBoundary key={pathname}>
          <CarryAcross />
          {/* Inside the frame (F8): while a screen's code downloads, only this
              area waits. Above Shell, it took the header and nav with it. */}
          <Suspense fallback={<ScreenLoading />}>
            <Outlet />
          </Suspense>
        </ErrorBoundary>
      </main>

      {!focused && <nav className="sm:hidden fixed inset-x-0 bottom-0 z-30 bg-board shadow-lift
        pb-[env(safe-area-inset-bottom)]">
        <div className="max-w-3xl mx-auto grid grid-cols-4">
          {TABS.map((t) => {
            const active = isActive(pathname, t.to, t.exact);
            return (
              <NavLink key={t.to} to={t.to}
                className="relative grid place-items-center gap-0.5 py-2.5">
                {active && (
                  <motion.span layoutId="tab-pill-bottom"
                    className="absolute inset-x-2 inset-y-1 bg-petal rounded-2xl"
                    transition={{ type: "spring", stiffness: 420, damping: 32 }} />
                )}
                <span className="relative"><t.Icon /></span>
                <span className={`relative text-[12px] font-black
                  ${active ? "text-ink" : "text-soft"}`}>{t.label}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>}

      {!focused && <PushOnboarding />}
      {user && <InviteToast />}
    </div>
  );
}
