import { useId } from "react";
import badges from "@/shared/data/rank-badges.json";
import { rankFor, RANKS } from "@/features/play/rank";
import { hue } from "@/shared/ui/Avatar";
import { INK, BOARD, RAMPS, SCENE, SKIES, skyAt } from "@/shared/brand/tokens";

/** A friend standing at their rank on the road (#48). */
export interface OnRoad { id: string; name: string; answered: number }

/**
 * The road to the sun (#48), from the drawing's own scene: a 300×640 picture
 * that fills the phone (slice), a hill, a sand road switching back up it, and
 * a stop for each rank. Where each stop's foot is, and how big its flower
 * stands there (smaller as the road climbs away), comes from the drawing.
 */
const FOOT: [number, number, number, number][] = [
  // x, y, scale, shadow width
  [80, 530, 0.4835, 21], [214, 488, 0.4615, 20], [104, 442, 0.4396, 19], [204, 396, 0.4176, 18],
  [104, 336, 0.3956, 17], [200, 276, 0.3736, 16], [114, 228, 0.3297, 14], [196, 188, 0.2967, 13],
  [126, 154, 0.2637, 12],
];
/** Legend is the sun: centred on it, bigger. */
const SUN = { x: 212, y: 80, scale: 0.5495 };
const ROAD = "M40 700 Q24 650 60 600 Q96 564 80 528 Q121 507 214 486 Q185 463 104 440 Q128 417 204 394 Q180 364 104 334 Q126 304 200 274 Q183 250 114 226 Q129 206 196 186 Q187 169 126 152 Q121 140 168 128";

type BadgeData = { viewBox: string; paths: string };
const B = badges as Record<string, BadgeData>;
const width = (key: string) => Number(B[key].viewBox.split(" ")[2]);

/** A rank's flower with its foot at (x, y). The badges share a height of 91
    units from -4, so the foot is 87 units under the origin. */
function Flower({ k, x, y, s, uid, locked }: { k: string; x: number; y: number; s: number; uid: string; locked?: boolean }) {
  const tx = x - (-4 + width(k) / 2) * s, ty = y - 87 * s;
  // Ids inside a badge are made unique per page, as Art does.
  const html = B[k].paths.replace(/\sid="([^"]+)"/g, ` id="$1-${uid}"`).replace(/href="#([^"]+)"/g, `href="#$1-${uid}"`)
    .replace(/url\(#([^)]+)\)/g, `url(#$1-${uid})`);
  return <g transform={`translate(${tx.toFixed(1)} ${ty.toFixed(1)}) scale(${s})`} className={locked ? "grayscale opacity-50" : undefined}
    dangerouslySetInnerHTML={{ __html: html }} />;
}

/** A friend as a small disc with their name under it (the drawing's .av in the scene). */
function Friend({ f, cx, cy }: { f: OnRoad; cx: number; cy: number }) {
  const r = RAMPS[hue(f.id)];
  const w = Math.max(40, f.name.length * 6 + 10);
  return (
    <g>
      <title>{f.name}</title>
      <circle cx={cx} cy={cy + 4} r={14} fill={INK} />
      <circle cx={cx} cy={cy} r={14} fill={INK} />
      <circle cx={cx} cy={cy} r={11} fill={r.base} />
      <path d={`M${cx - 8.8} ${cy - 2.75} A11 11 0 0 1 ${cx + 7.7} ${cy - 6.6}`} stroke={r.hi} strokeWidth={3.08} fill="none" strokeLinecap="round" />
      <text x={cx} y={cy + 3.96} fontSize={11.55} fill={INK} textAnchor="middle" style={{ fontFamily: "var(--font-display)" }}>{(f.name.trim()[0] ?? "?").toUpperCase()}</text>
      <rect x={cx - w / 2} y={cy + 15} width={w} height={15} rx={7} fill={BOARD} opacity={0.9} />
      <text x={cx} y={cy + 26} fontSize={9.5} fontWeight={800} fill={INK} textAnchor="middle">{f.name}</text>
    </g>
  );
}

export function SunRoad({ answered, friends = [] }: { answered: number; friends?: OnRoad[] }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const { current, next, progress } = rankFor(answered);
  const idx = RANKS.findIndex((r) => r.key === current.key);
  const hill = SKIES[skyAt()].hill;
  const ring = 2 * Math.PI * 47;
  const legend = RANKS[9];
  const toGo = next ? `${(next.min - answered).toLocaleString()} to go` : "";
  return (
    <svg viewBox="0 0 300 640" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 w-full h-full" role="img"
      aria-label={`The road to the sun: you're ${current.name}, rank ${idx + 1} of ${RANKS.length}${next ? `, ${toGo} to ${next.name}` : ""}.`}>
      <defs>
        <radialGradient id={`sun-${uid}`} cx=".5" cy=".5" r=".5">
          <stop offset="0" stopColor={SCENE.sunCore} />
          <stop offset=".55" stopColor={SCENE.sunGlow} stopOpacity=".7" />
          <stop offset="1" stopColor={SCENE.sunGlow} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`hill-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={hill[0]} />
          <stop offset=".35" stopColor={hill[1]} />
          <stop offset="1" stopColor={RAMPS.leaf.lo} />
        </linearGradient>
      </defs>
      <circle cx={SUN.x} cy={SUN.y} r={70} fill={`url(#sun-${uid})`} />
      <path d="M-40 250 C40 200 110 150 170 150 C230 150 280 190 340 230 L340 700 L-40 700 Z" fill={`url(#hill-${uid})`} />
      <path d="M-40 300 C60 250 120 240 180 250 C240 260 300 300 340 330" fill="none" stroke={BOARD} strokeOpacity=".25" strokeWidth="3" />
      <path d={ROAD} stroke={SCENE.roadEdge} strokeWidth="22" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d={ROAD} stroke={SCENE.road} strokeWidth="15" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d={ROAD} stroke={SCENE.roadDash} strokeWidth="3" fill="none" strokeLinecap="round" strokeDasharray="2 12" />

      {/* Legend, at the sun */}
      <g transform={`translate(${(SUN.x - 66 * SUN.scale).toFixed(1)} ${(SUN.y - 3 - 41.5 * SUN.scale).toFixed(1)}) scale(${SUN.scale})`}
        className={idx < 9 ? "grayscale opacity-50" : undefined}
        dangerouslySetInnerHTML={{ __html: B.legend.paths.replace(/\sid="([^"]+)"/g, ` id="$1-${uid}l"`).replace(/href="#([^"]+)"/g, `href="#$1-${uid}l"`).replace(/url\(#([^)]+)\)/g, `url(#$1-${uid}l)`) }} />
      {next?.key === legend.key ? (
        <g>
          <rect x={SUN.x - 43} y={108} width={86} height={32} rx={10} fill={BOARD} opacity=".95" />
          <text x={SUN.x} y={121} fontSize={10.5} fontWeight={800} fill={INK} textAnchor="middle">{legend.name}</text>
          <text x={SUN.x} y={134} fontSize={10.5} fontWeight={800} fill={RAMPS.petal.deep} textAnchor="middle">{toGo}</text>
        </g>
      ) : (
        <g>
          <rect x={SUN.x - 28} y={108} width={56} height={18} rx={9} fill={BOARD} opacity=".92" />
          <text x={SUN.x} y={121} fontSize={11} fontWeight={800} fill={INK} textAnchor="middle">{legend.name}</text>
        </g>
      )}

      {FOOT.map(([x, y, s, sw], i) => {
        const k = RANKS[i].key;
        const mine = i === idx;
        if (mine) {
          const cy = y - 42;
          return (
            <g key={k}>
              <ellipse cx={x} cy={y} rx={37} ry={10} fill={SCENE.shade} opacity=".3" />
              <circle cx={x} cy={cy} r={47} fill={BOARD} fillOpacity=".5" />
              <circle cx={x} cy={cy} r={47} fill="none" stroke={BOARD} strokeWidth="7" />
              <circle cx={x} cy={cy} r={47} fill="none" stroke={RAMPS.petal.base} strokeWidth="7" strokeLinecap="round"
                strokeDasharray={`${(ring * progress).toFixed(1)} 999`} transform={`rotate(-90 ${x} ${cy})`} />
              <Flower k={k} x={x} y={y - 11} s={0.7253} uid={uid} />
            </g>
          );
        }
        return (
          <g key={k}>
            <ellipse cx={x} cy={y} rx={sw} ry={sw > 17 ? 6 : sw > 12 ? 5 : 4} fill={SCENE.shade} opacity=".3" />
            <Flower k={k} x={x} y={y} s={s} uid={uid} locked={i > idx} />
            {next?.key === k && (
              <g>
                <rect x={x - 43} y={y - 87 * s - 40} width={86} height={32} rx={10} fill={BOARD} opacity=".95" />
                <text x={x} y={y - 87 * s - 27} fontSize={10.5} fontWeight={800} fill={INK} textAnchor="middle">{RANKS[i].name}</text>
                <text x={x} y={y - 87 * s - 14} fontSize={10.5} fontWeight={800} fill={RAMPS.petal.deep} textAnchor="middle">{toGo}</text>
              </g>
            )}
          </g>
        );
      })}

      {/* You, beside your stop (or under the sun at the top) */}
      {(() => {
        const [x, y] = idx < 9 ? FOOT[idx] : [SUN.x - 20, 150];
        const left = idx < 9 && x > 150;
        const tx = idx < 9 ? (left ? x - 80 : x + 40) : x;
        return (
          <g>
            <rect x={tx} y={y - 26} width={40} height={22} rx={8} fill={INK} />
            <text x={tx + 20} y={y - 11} fontSize={12} fontWeight={800} fill={BOARD} textAnchor="middle">You</text>
          </g>
        );
      })()}

      {/* Friends stand beside their rank, two a stop at most, named. */}
      {RANKS.slice(0, 9).map((r, i) => {
        const here = friends.filter((f) => rankFor(f.answered).current.key === r.key).slice(0, 2);
        const [x, y] = FOOT[i];
        const side = x < 150 ? -1 : 1;
        const out = i === idx ? 64 : 34;
        return here.map((f, k) => <Friend key={f.id} f={f} cx={x + side * (out + k * 32)} cy={y - 16} />);
      })}
    </svg>
  );
}
