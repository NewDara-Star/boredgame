import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "@/app/providers/AuthProvider";

const link = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
    isActive ? "bg-panel-2 text-chalk" : "text-dim hover:text-chalk"
  }`;

export function Shell() {
  const { offline, user } = useAuth();
  return (
    <div className="min-h-full flex flex-col">
      <header className="border-b border-line sticky top-0 z-20 bg-ink/95 backdrop-blur">
        <nav className="max-w-3xl mx-auto flex items-center gap-1 px-3 h-14">
          <NavLink to="/" className="font-bold tracking-tight mr-2 text-base">BoredGame</NavLink>
          <NavLink to="/picto" className={link}>Picto</NavLink>
          <NavLink to="/trivia" className={link}>Trivia</NavLink>
          <NavLink to="/rooms" className={link}>Rooms</NavLink>
          <div className="flex-1" />
          <NavLink to="/profile" className={link}>{user ? "Profile" : "Sign in"}</NavLink>
        </nav>
      </header>

      {offline && (
        <div className="bg-picto/10 border-b border-picto/30 text-picto text-xs px-4 py-2 text-center">
          Running on bundled content — no database connected. Add Supabase keys to .env for accounts,
          saved progress and multiplayer.
        </div>
      )}

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
