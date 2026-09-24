import { useId, type CSSProperties } from "react";

/**
 * Every drawn asset (the sunflower, game tiles, nav icons, the wordmark) lives in
 * ./art as SVG, generated from the brand guide. They are inlined, not <img>, so
 * CSS can animate the flower's groups (.sf-head, .sf-petals, .sf-disc, .sf-feat).
 */
const ART = import.meta.glob("./art/*.svg", { query: "?raw", import: "default", eager: true }) as Record<string, string>;

export const hasArt = (name: string) => `./art/${name}.svg` in ART;
/** The untouched SVG, for drawing onto a canvas (share cards). */
export const artRaw = (name: string) => ART[`./art/${name}.svg`] ?? "";

/** Ids are made unique per instance: two tiles with the same gradient id on one page
    would otherwise both read the first one, and a hidden first one paints nothing. */
export function artMarkup(name: string, uid: string) {
  const raw = ART[`./art/${name}.svg`] ?? "";
  return raw
    .replace("<svg ", '<svg width="100%" style="display:block;height:auto;overflow:visible" ')
    .replace(/\sid="([^"]+)"/g, ` id="$1-${uid}"`)
    .replace(/url\(#([^)]+)\)/g, `url(#$1-${uid})`)
    .replace(/href="#([^"]+)"/g, `href="#$1-${uid}"`);
}

export function Art({ name, className = "", style, label }:
  { name: string; className?: string; style?: CSSProperties; label?: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  return (
    <span className={`inline-block align-middle ${className}`} style={style}
      role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}
      dangerouslySetInnerHTML={{ __html: artMarkup(name, uid) }} />
  );
}
