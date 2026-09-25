/**
 * Story cards for the moments that had no share: a new rank and a streak
 * milestone. Same six parts as a result card, on a world that isn't a game's:
 * gold for a rank, ember for a streak.
 */
import badges from "@/shared/data/rank-badges.json";
import { RAMPS, type Ramp } from "@/shared/brand/tokens";
import type { Rank } from "@/features/play/rank";
import {
  badgeImage, cardImage, drawStory, fitSize, DISPLAY, INK,
  type Box, type Ctx, type MatchCard,
} from "./frame";

/** Rays behind the thing being celebrated, from the plate's centre. */
function burst(c: Ctx, box: Box, ramp: Ramp) {
  const cx = box.x + box.w / 2, cy = box.y + box.h / 2, r = Math.hypot(box.w, box.h);
  c.save();
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    c.beginPath(); c.moveTo(cx, cy);
    c.arc(cx, cy, r, a, a + Math.PI / 18); c.closePath();
    c.fillStyle = i % 2 ? ramp.hi : "rgba(255,255,255,0)"; c.globalAlpha = 0.55; c.fill();
  }
  c.restore();
}

function fit(c: Ctx, img: HTMLImageElement, box: Box, scale: number, dy = 0) {
  const h = box.h * scale, w = (h * img.naturalWidth) / img.naturalHeight;
  c.drawImage(img, box.x + (box.w - w) / 2, box.y + (box.h - h) / 2 + dy, w, h);
}

export async function rankStory(rank: Rank): Promise<MatchCard> {
  const b = badges[rank.key];
  const img = await badgeImage(rank.key, b.viewBox, b.paths);
  return drawStory({
    title: `rank ${rank.name}`, code: null, ramp: RAMPS.petal, path: "/you/road",
    headline: `I made ${rank.name}`,
    sub: `${rank.min} questions answered`,
    hero: (c, box) => { burst(c, box, RAMPS.petal); if (img) fit(c, img, box, 0.86); },
    dare: "Catch me?", flower: "bloom",
    text: `I just made ${rank.name} on BoredGame. Catch me:`,
  });
}

export async function streakStory(days: number, name: string): Promise<MatchCard> {
  return drawStory({
    title: `streak ${days}`, code: null, ramp: RAMPS.ember, path: "/daily",
    headline: `${days} days in a row`,
    sub: name,
    hero: (c, box) => {
      burst(c, box, RAMPS.ember);
      const flame = cardImage("streak");
      if (flame) fit(c, flame, { ...box, h: box.h * 0.62 }, 1, -10);
      c.fillStyle = INK; c.textAlign = "center"; c.textBaseline = "middle";
      c.font = `400 ${fitSize(c, String(days), box.w * 0.6, 190)}px ${DISPLAY}`;
      c.fillText(String(days), box.x + box.w / 2, box.y + box.h * 0.8);
    },
    dare: "Start yours?", flower: "bloom",
    text: `${days} days in a row on BoredGame. Start yours:`,
  });
}
