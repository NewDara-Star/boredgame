import { lazy } from "react";
import { MotionConfig } from "framer-motion";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/app/providers/AuthProvider";
import { Shell } from "@/app/layout/Shell";
import { VoiceProvider } from "@/features/voice/VoiceProvider";
import { HomePage } from "@/features/home/HomePage";

/**
 * Home is imported eagerly; everything else is fetched when it is first opened.
 *
 * The whole app used to arrive as one 745 kB file before anything appeared on
 * screen — the admin screen, both room games and every board engine downloaded
 * by someone who opened the home page on mobile data and never left it. Route
 * splitting is the entire fix. While a screen's file is in flight, Shell's
 * Suspense keeps the header and nav and waits in the page area (F8).
 */
const PictoGame = lazy(() => import("@/features/picto/PictoGame").then((m) => ({ default: m.PictoGame })));
const TriviaGame = lazy(() => import("@/features/trivia/TriviaGame").then((m) => ({ default: m.TriviaGame })));
const CataloguePage = lazy(() => import("@/features/play/CataloguePage").then((m) => ({ default: m.CataloguePage })));
const DailyPage = lazy(() => import("@/features/daily/DailyPage").then((m) => ({ default: m.DailyPage })));
const LeaderboardPage = lazy(() => import("@/features/leaderboard/LeaderboardPage").then((m) => ({ default: m.LeaderboardPage })));
const RoadPage = lazy(() => import("@/features/leaderboard/RoadPage").then((m) => ({ default: m.RoadPage })));
const ProfilePage = lazy(() => import("@/features/profile/ProfilePage").then((m) => ({ default: m.ProfilePage })));
const AdminPage = lazy(() => import("@/features/admin/AdminPage").then((m) => ({ default: m.AdminPage })));
const TicTacToeSoloPage = lazy(() => import("@/features/tictactoe/TicTacToeSoloPage").then((m) => ({ default: m.TicTacToeSoloPage })));
const Connect4SoloPage = lazy(() => import("@/features/connect4/Connect4SoloPage").then((m) => ({ default: m.Connect4SoloPage })));
const MemorySoloPage = lazy(() => import("@/features/memory/MemorySoloPage").then((m) => ({ default: m.MemorySoloPage })));
const SortSoloPage = lazy(() => import("@/features/sort/SortSoloPage").then((m) => ({ default: m.SortSoloPage })));
const RoomsPage = lazy(() => import("@/features/rooms/RoomsPage").then((m) => ({ default: m.RoomsPage })));
const AddFriendPage = lazy(() => import("@/features/friends/AddFriendPage").then((m) => ({ default: m.AddFriendPage })));

export function App() {
  return (
    <MotionConfig reducedMotion="user">
    <AuthProvider>
      <BrowserRouter>
        <VoiceProvider>
          <Routes>
            <Route element={<Shell />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/picto" element={<PictoGame />} />
              <Route path="/trivia" element={<TriviaGame />} />
              <Route path="/play" element={<CataloguePage />} />
              <Route path="/daily" element={<DailyPage />} />
              <Route path="/squareoff" element={<Navigate to="/tictactoe?with=trivia" replace />} />
              <Route path="/tictactoe" element={<TicTacToeSoloPage />} />
              <Route path="/connect4" element={<Connect4SoloPage />} />
              <Route path="/connect4trivia" element={<Navigate to="/connect4?with=trivia" replace />} />
              <Route path="/connect4catapult" element={<Navigate to="/connect4?with=cup" replace />} />
              <Route path="/catapultsquares" element={<Navigate to="/tictactoe?with=cup" replace />} />
              <Route path="/memory" element={<MemorySoloPage />} />
              <Route path="/ballsort" element={<SortSoloPage />} />
              {/* You (#46–#51): your profile, the road and everyone. The old
                  addresses still work, for links already shared. */}
              <Route path="/you" element={<ProfilePage />} />
              <Route path="/you/road" element={<RoadPage />} />
              <Route path="/you/everyone" element={<LeaderboardPage />} />
              <Route path="/profile" element={<Navigate to="/you" replace />} />
              <Route path="/ranks" element={<Navigate to="/you/everyone" replace />} />
              <Route path="/admin" element={<AdminPage />} />
              <Route path="/rooms" element={<RoomsPage />} />
              <Route path="/rooms/:code" element={<RoomsPage />} />
              <Route path="/add/:code" element={<AddFriendPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </VoiceProvider>
      </BrowserRouter>
    </AuthProvider>
    </MotionConfig>
  );
}
