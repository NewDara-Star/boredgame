import { useState } from "react";
import { shareResult, type MatchCard } from "./frame";

const SAID = { shared: "Sent", saved: "Saved", copied: "Link copied", cancelled: "" } as const;

/**
 * Share (the square card, with the dare and link as text) and Story (the tall
 * one). Every share point in the app uses these two, so a card can't go out
 * without its way back in.
 *
 * The click handlers call shareResult() straight away; see share.ts for why
 * nothing may be awaited first.
 */
export function ShareButtons({ card, story = true, className = "" }:
  { card: MatchCard | null; story?: boolean; className?: string }) {
  const [said, setSaid] = useState("");
  const go = (file: File | undefined) => {
    if (!card || !file) return;
    void shareResult({ file, text: card.text ?? "", url: card.link })
      .then((r) => { setSaid(SAID[r]); if (r !== "cancelled") setTimeout(() => setSaid(""), 2500); });
  };
  const tall = story && !!card?.story && card.story !== card.file;
  return (
    <div className={`grid gap-2.5 ${tall ? "grid-cols-[1.4fr_1fr]" : "grid-cols-1"} ${className}`}>
      <button onClick={() => go(card?.file)} disabled={!card}
        className="cut tap py-3.5 font-display text-lg cut-petal disabled:opacity-50">
        {said || "Share"}
      </button>
      {tall && (
        <button onClick={() => go(card?.story)} disabled={!card}
          className="cut tap py-3.5 font-display text-lg cut-sky disabled:opacity-50">
          Story
        </button>
      )}
    </div>
  );
}
