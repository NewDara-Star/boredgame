import { motion } from "framer-motion";
import { riseIn, stagger } from "@/shared/ui/motion";
import { Carousel } from "@/shared/ui/Carousel";

export interface Stat {
  label: string;
  value: string | number;
  note?: string;
  bg: string;
  fg?: string;
}

/** Swipeable rather than a grid: it holds as many as we add without pushing
    everything below it further down the page. */
export function StatCarousel({ stats }: { stats: Stat[] }) {
  return (
    <motion.div variants={stagger(0.05)}>
      <Carousel>
      {stats.map((s) => (
        <motion.div key={s.label} variants={riseIn}
          className={`piece snap-start shrink-0 w-[148px] p-4 ${s.bg} ${s.fg ?? ""}`}>
          <span className="block text-[9.5px] font-black uppercase tracking-widest opacity-70">
            {s.label}
          </span>
          <b className="block font-display text-[34px] leading-none font-semibold tabular-nums mt-2">
            {s.value}
          </b>
          {s.note && (
            <span className="block text-[11px] font-bold opacity-70 mt-1.5">{s.note}</span>
          )}
        </motion.div>
      ))}
      </Carousel>
    </motion.div>
  );
}
