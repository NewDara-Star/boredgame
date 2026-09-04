import { useAuth } from "@/app/providers/AuthProvider";
import { readLocal } from "./progress";

/**
 * The database is authoritative when signed in; localStorage only covers the
 * anonymous case. Home used to read localStorage unconditionally, so a signed-in
 * player saw this browser's tally rather than their own account's.
 */
export function useProgress() {
  const { user, profile } = useAuth();
  const local = readLocal(user?.id);

  if (user && profile) {
    return {
      answered: profile.total_answered,
      correct: profile.total_correct,
      bestScore: local.bestScore,
    };
  }
  return { answered: local.answered, correct: local.correct, bestScore: local.bestScore };
}
