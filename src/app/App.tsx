import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/app/providers/AuthProvider";
import { Shell } from "@/app/layout/Shell";
import { HomePage } from "@/features/home/HomePage";
import { PictoGame } from "@/features/picto/PictoGame";
import { TriviaGame } from "@/features/trivia/TriviaGame";
import { ProfilePage } from "@/features/profile/ProfilePage";
import { AdminPage } from "@/features/admin/AdminPage";
import { RoomsPage } from "@/features/rooms/RoomsPage";
import { LeaderboardPage } from "@/features/leaderboard/LeaderboardPage";
import { SquareOffPage } from "@/features/squareoff/SquareOffPage";
import { CataloguePage } from "@/features/play/CataloguePage";
import { DailyPage } from "@/features/daily/DailyPage";

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Shell />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/picto" element={<PictoGame />} />
            <Route path="/trivia" element={<TriviaGame />} />
            <Route path="/play" element={<CataloguePage />} />
            <Route path="/daily" element={<DailyPage />} />
            <Route path="/squareoff" element={<SquareOffPage />} />
            <Route path="/ranks" element={<LeaderboardPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/rooms" element={<RoomsPage />} />
            <Route path="/rooms/:code" element={<RoomsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
