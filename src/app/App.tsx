import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/app/providers/AuthProvider";
import { Shell } from "@/app/layout/Shell";
import { HomePage } from "@/features/home/HomePage";

/**
 * Home is imported eagerly; everything else is fetched when it is first opened.
 *
 * The whole app used to arrive as one 745 kB file before anything appeared on
 * screen — the admin screen, both room games and every board engine downloaded
 * by someone who opened the home page on mobile data and never left it. Route
 * splitting is the entire fix, and React Router already renders a fallback
 * while a chunk is in flight.
 */
const PictoGame = lazy(() => import("@/features/picto/PictoGame").then((m) => ({ default: m.PictoGame })));
const TriviaGame = lazy(() => import("@/features/trivia/TriviaGame").then((m) => ({ default: m.TriviaGame })));
const CataloguePage = lazy(() => import("@/features/play/CataloguePage").then((m) => ({ default: m.CataloguePage })));
const DailyPage = lazy(() => import("@/features/daily/DailyPage").then((m) => ({ default: m.DailyPage })));
const SquareOffPage = lazy(() => import("@/features/squareoff/SquareOffPage").then((m) => ({ default: m.SquareOffPage })));
const LeaderboardPage = lazy(() => import("@/features/leaderboard/LeaderboardPage").then((m) => ({ default: m.LeaderboardPage })));
const ProfilePage = lazy(() => import("@/features/profile/ProfilePage").then((m) => ({ default: m.ProfilePage })));
const AdminPage = lazy(() => import("@/features/admin/AdminPage").then((m) => ({ default: m.AdminPage })));
const TicTacToeSoloPage = lazy(() => import("@/features/tictactoe/TicTacToeSoloPage").then((m) => ({ default: m.TicTacToeSoloPage })));
const Connect4SoloPage = lazy(() => import("@/features/connect4/Connect4SoloPage").then((m) => ({ default: m.Connect4SoloPage })));
const Connect4TriviaSoloPage = lazy(() => import("@/features/connect4/Connect4SoloPage").then((m) => ({ default: m.Connect4TriviaSoloPage })));
const Connect4CatapultSoloPage = lazy(() => import("@/features/connect4/Connect4SoloPage").then((m) => ({ default: m.Connect4CatapultSoloPage })));
const SquareOffCatapultPage = lazy(() => import("@/features/squareoff/SquareOffCatapultPage").then((m) => ({ default: m.SquareOffCatapultPage })));
const MemorySoloPage = lazy(() => import("@/features/memory/MemorySoloPage").then((m) => ({ default: m.MemorySoloPage })));
const RoomsPage = lazy(() => import("@/features/rooms/RoomsPage").then((m) => ({ default: m.RoomsPage })));

/** Deliberately plain. A spinner that appears for 80ms on a fast connection is
    worse than nothing; this only ever shows on a slow one. */
function Loading() {
  return <p className="text-[13px] font-bold text-soft">Loading…</p>;
}

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route element={<Shell />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/picto" element={<PictoGame />} />
              <Route path="/trivia" element={<TriviaGame />} />
              <Route path="/play" element={<CataloguePage />} />
              <Route path="/daily" element={<DailyPage />} />
              <Route path="/squareoff" element={<SquareOffPage />} />
              <Route path="/tictactoe" element={<TicTacToeSoloPage />} />
              <Route path="/connect4" element={<Connect4SoloPage />} />
              <Route path="/connect4trivia" element={<Connect4TriviaSoloPage />} />
              <Route path="/connect4catapult" element={<Connect4CatapultSoloPage />} />
              <Route path="/catapultsquares" element={<SquareOffCatapultPage />} />
              <Route path="/memory" element={<MemorySoloPage />} />
              <Route path="/ranks" element={<LeaderboardPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/admin" element={<AdminPage />} />
              <Route path="/rooms" element={<RoomsPage />} />
              <Route path="/rooms/:code" element={<RoomsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}
