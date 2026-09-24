import { Art, hasArt } from "./Art";

/**
 * Every game's tile: a cut gem in its family colour with a seed spiral and one
 * outlined hero object (BRAND.md, "Game families"). A game with no drawing yet falls
 * back to the empty "next" slot rather than to nothing.
 */
export function GameTile({ slug, size = 64, className = "", label }:
  { slug: string; size?: number; className?: string; label?: string }) {
  const name = hasArt(`game-${slug}`) ? `game-${slug}` : "game-next";
  return <Art name={name} className={className} style={{ width: size }} label={label} />;
}
