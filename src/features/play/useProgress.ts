import { useAuth } from "@/app/providers/AuthProvider";
import { readLocal } from "./progress";
import { isAlive, today } from "./streak";

/**
 * The database is authoritative when signed in; localStorage only covers the
 * anonymous case. Home used to read localStorage unconditionally, so a signed-in
 * player saw this browser's tally rather than their own account's.
 */
export function useProgress() {
  const { user, profile } = useAuth();
  const local = readLocal(user?.id);
  const signedIn = user && profile;

  const lastPlayed = signedIn ? profile.last_played : local.lastPlayed;
  const stored = signedIn ? profile.streak : local.streak;

  return {
    answered: signedIn ? profile.total_answered : local.answered,
    correct: signedIn ? profile.total_correct : local.correct,
    bestScore: local.bestScore,
    /** A run you have already dropped shows as 0, not as the number you used to
        have — a stale 12 next to a broken streak is worse than no number. */
    streak: isAlive(lastPlayed) ? stored : 0,
    bestStreak: signedIn ? profile.best_streak : local.bestStreak,
    lastPlayed,
    playedToday: lastPlayed === today(),
  };
}
