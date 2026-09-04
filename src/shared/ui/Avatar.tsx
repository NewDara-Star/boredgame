const HUES = ["#EF5A2A", "#4B5BD6", "#FFC93C", "#17914B", "#D93A34", "#6B6154"];

/** Same id, same colour, forever — including across devices, so it reads as identity. */
function hue(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return HUES[h % HUES.length];
}

export function Avatar({
  id, name, size = 44, className = "",
}: { id: string; name: string; size?: number; className?: string }) {
  const bg = hue(id);
  // Yellow is the one colour in the palette that ink reads better on than paper.
  const fg = bg === "#FFC93C" ? "#191510" : "#FFFFFF";
  return (
    <span
      className={`piece grid place-items-center shrink-0 font-display font-semibold ${className}`}
      style={{
        width: size, height: size, borderRadius: 999,
        background: bg, color: fg, fontSize: size * 0.42, lineHeight: 1,
      }}
      aria-hidden>
      {(name.trim()[0] ?? "?").toUpperCase()}
    </span>
  );
}
