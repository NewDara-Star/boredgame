import { useEffect, useState } from "react";
import { SKIES, skyAt, type SkyName } from "./tokens";

/**
 * The sky clock (BRAND.md rule 4). The phone's own hour picks the sky; for the last
 * 30 minutes of each sky the colours blend into the next one. It also stamps
 * <html data-sky> so the night can turn the page's ink white (see index.css).
 * With reduced motion it still follows the clock; it just never blends.
 */
const ORDER: SkyName[] = ["morning", "midday", "golden", "night"];
const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a: string, b: string, t: number) => {
  const [x, y] = [hex(a), hex(b)];
  return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(",")})`;
};

function skyNow(d = new Date()) {
  const name = skyAt(d);
  const s = SKIES[name];
  const next = SKIES[ORDER[(ORDER.indexOf(name) + 1) % ORDER.length]];
  const h = d.getHours() + d.getMinutes() / 60;
  const until = ((s.to - h) + 24) % 24;
  const reduce = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const t = !reduce && until < 0.5 ? 1 - until / 0.5 : 0;
  return { name, stops: s.stops.map((c, i) => mix(c, next.stops[i], t)) };
}

export function Sky() {
  const [sky, setSky] = useState(skyNow);
  useEffect(() => {
    const id = setInterval(() => setSky(skyNow()), 60_000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => { document.documentElement.dataset.sky = sky.name; }, [sky.name]);
  const [a, b, c] = sky.stops;
  return (
    <div aria-hidden className="fixed inset-0 -z-10 pointer-events-none"
      style={{ background: `linear-gradient(180deg, ${a} 0%, ${b} 45%, ${c} 100%)` }}>
      <SeedSpiral />
    </div>
  );
}

/** The brand texture: each seed 137.5° round from the last, radius growing with √k. */
function SeedSpiral() {
  const dots = [];
  for (let k = 1; k <= 260; k++) {
    const a = k * 2.39996, r = 13 * Math.sqrt(k), d = 0.8 + (3.4 * k) / 260;
    dots.push(<circle key={k} cx={(50 + r * Math.cos(a)).toFixed(1)} cy={(18 + r * Math.sin(a)).toFixed(1)} r={d.toFixed(1)} />);
  }
  return (
    <svg className="absolute inset-x-0 top-0 w-full h-[60vh]" viewBox="-200 -120 500 300" preserveAspectRatio="xMidYMin slice"
      fill="white" opacity="0.16">{dots}</svg>
  );
}
