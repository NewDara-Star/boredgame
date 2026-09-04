import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { SPRING } from "@/shared/ui/motion";

export interface CategoryCount { name: string; count: number }

/**
 * Collapsed by default. An always-open filter row is the first thing you see on
 * a screen whose job is to show a question, and most rounds do not want one.
 */
export function CategoryBar({
  categories, selected, onChange,
}: { categories: CategoryCount[]; selected: string[]; onChange: (next: string[]) => void }) {
  const [open, setOpen] = useState(false);
  if (categories.length === 0) return null;

  const toggle = (name: string) =>
    onChange(selected.includes(name) ? selected.filter((n) => n !== name) : [...selected, name]);

  const inPlay = selected.length
    ? categories.filter((c) => selected.includes(c.name)).reduce((n, c) => n + c.count, 0)
    : categories.reduce((n, c) => n + c.count, 0);

  return (
    <div className="mb-3">
      <button onClick={() => setOpen((o) => !o)}
        className="piece press flex items-center gap-2 px-3 py-1.5 text-[11px] font-black
          uppercase tracking-wider rounded-xl">
        <span>{selected.length === 0 ? "All categories" : `${selected.length} selected`}</span>
        <span className="text-soft tabular-nums">{inPlay}</span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={SPRING} className="leading-none">▾</motion.span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="flex flex-wrap gap-1.5 pt-2.5">
              {categories.map((c) => {
                const on = selected.includes(c.name);
                return (
                  <button key={c.name} onClick={() => toggle(c.name)}
                    className={`border-2 border-ink rounded-full px-2.5 py-1 text-[11px] font-bold
                      ${on ? "bg-ink text-paper" : "bg-surface text-ink"}`}>
                    {c.name} <span className="opacity-60 tabular-nums">{c.count}</span>
                  </button>
                );
              })}
              {selected.length > 0 && (
                <button onClick={() => onChange([])}
                  className="border-2 border-ink rounded-full px-2.5 py-1 text-[11px] font-black
                    uppercase tracking-wider bg-pop">
                  Clear
                </button>
              )}
            </div>
            <p className="text-[11px] font-bold text-soft mt-2">
              Changing this starts a fresh round.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
