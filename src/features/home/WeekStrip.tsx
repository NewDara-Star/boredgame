import { motion } from "framer-motion";
import { SPRING } from "@/shared/ui/motion";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * The last seven days, with the ones you played filled in.
 *
 * Derived from the streak rather than queried: a streak of N ending on
 * `lastPlayed` means exactly those N consecutive days were played, so the strip
 * is true without another round trip. It stops being true if we ever let a
 * streak survive a missed day — don't.
 */
export function WeekStrip({ streak, lastPlayed }: { streak: number; lastPlayed: string | null }) {
  // Both sides have to be midnight. Comparing a date parsed at 00:00 against a
  // `new Date()` carrying the current time put every day out by one: at 14:30 the
  // difference to today was -0.6 days, rounded to -1, and today read as unplayed
  // while the four days before it lit up.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = lastPlayed ? new Date(`${lastPlayed}T00:00:00`) : null;

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (6 - i));
    d.setHours(0, 0, 0, 0);
    const daysBeforeEnd = end
      ? Math.round((end.getTime() - d.getTime()) / 86_400_000)
      : Infinity;
    return {
      key: d.toISOString().slice(0, 10),
      label: DAYS[d.getDay()],
      date: d.getDate(),
      isToday: i === 6,
      played: daysBeforeEnd >= 0 && daysBeforeEnd < streak,
    };
  });

  return (
    <div className="flex gap-1.5 justify-between">
      {days.map((d, i) => (
        <motion.div key={d.key}
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING, delay: i * 0.035 }}
          className={`flex-1 rounded-2xl border-[2.5px] border-ink py-2 text-center
            ${d.played ? "bg-pop" : d.isToday ? "bg-surface" : "bg-sand/60"}`}>
          <span className="block text-[9px] font-black uppercase tracking-wide text-soft">
            {d.label}
          </span>
          <span className="block font-display text-[17px] font-semibold tabular-nums leading-tight">
            {d.date}
          </span>
          <span className={`block h-1.5 w-1.5 rounded-full mx-auto mt-1
            ${d.played ? "bg-ink" : d.isToday ? "bg-hot" : "bg-transparent"}`} />
        </motion.div>
      ))}
    </div>
  );
}
