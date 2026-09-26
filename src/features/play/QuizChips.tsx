import { Sunflower } from "@/shared/brand/Sunflower";
import { LEVELS, toggle, type Level } from "./levels";

/**
 * What to play, as one row of chips you swipe sideways (#20, Daramola 26 Sep):
 * the level first, then the categories. The drawing's .cats: 800 13px white
 * pills, gold when on. Shown above the first question only; changing one deals
 * a fresh round. It replaces the folded "All categories" panel.
 *
 * Categories: none on means every category. Levels: never none at all.
 */
const NAME: Record<Level, string> = { easy: "Easy", medium: "Medium", hard: "Hard" };

export function QuizChips({ levels, onLevels, categories, selected, onCategories }: {
  levels: Level[]; onLevels: (next: Level[]) => void;
  categories: string[]; selected: string[]; onCategories: (next: string[]) => void;
}) {
  const chip = (key: string, label: string, on: boolean, tap: () => void) => (
    <button key={key} onClick={tap} aria-pressed={on}
      className="shrink-0 min-h-[44px] -my-[7px] grid place-items-center">
      <span className={`chip rounded-full px-[11px] py-[5px] text-[13px] font-extrabold text-ink ${on ? "bg-petal" : "bg-board"}`}>{label}</span>
    </button>
  );
  return (
    <div role="group" aria-label="What to play"
      className="flex gap-1.5 overflow-x-auto -mx-4 px-4 py-[7px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {LEVELS.map((l) => chip(l, NAME[l], levels.includes(l), () => onLevels(toggle(levels, l))))}
      {categories.map((c) => chip(`c-${c}`, c, selected.includes(c),
        () => onCategories(selected.includes(c) ? selected.filter((x) => x !== c) : [...selected, c])))}
    </div>
  );
}

/** #24: say which filters leave nothing, and what to try. */
export function nothingFor(levels: Level[], selected: string[]) {
  const lv = levels.length < LEVELS.length ? levels.map((l) => NAME[l].toLowerCase()).join(" or ") + " " : "";
  const cats = selected.length === 1 ? selected[0].toLowerCase() + " " : selected.length ? "" : "";
  const those = selected.length > 1 ? " in those categories" : "";
  const title = `No ${lv}${cats}questions yet${those}`;
  const other = LEVELS.filter((l) => !levels.includes(l)).map((l) => NAME[l].toLowerCase());
  const tries = [other.length ? `Try ${other.join(" or ")}` : "", selected.length ? "every category" : ""].filter(Boolean);
  const say = tries.length === 2 ? `${tries[0]}, or ${tries[1]}.` : tries.length ? `${tries[0].charAt(0).toUpperCase()}${tries[0].slice(1)}.` : "Try again soon.";
  return { title, say: say.startsWith("every") ? "Try every category." : say };
}

/** #24, from the drawing's code: the flower looking aside (100px), what leaves
    nothing, what to try, and one gold button that clears it all. */
export function NothingMatches({ levels, selected, onClear }: { levels: Level[]; selected: string[]; onClear: () => void }) {
  const { title, say } = nothingFor(levels, selected);
  return (
    <div className="card shadow-lift-sm rounded-[20px] p-5 grid gap-2 justify-items-center text-center">
      <Sunflower state="look-right" size={100} />
      <h3 className="font-display text-[22px] leading-[1.1]">{title}</h3>
      <p className="text-[14px] font-semibold text-soft">{say}</p>
      <button onClick={onClear} className="cut tap cut-petal w-full min-h-[52px] font-display text-[19px]">Clear the filters</button>
    </div>
  );
}
