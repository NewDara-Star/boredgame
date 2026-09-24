/**
 * Getting a card (or just a line of text) off the phone. The only place in the app
 * that hands something to the share sheet.
 *
 * Two things this must not do. It must not await anything before calling share():
 * iOS requires transient activation, and a single await between the tap and the
 * call loses it — which is why cards are drawn to Files before the button is shown.
 * And it must not treat Web Share as present just because `navigator.share` exists;
 * desktop Chrome has it and refuses files. `canShare({ files })` is the only test
 * that answers the real question.
 *
 * Every share carries the dare and the link as text, so an image that lands in a
 * chat arrives with a way in (SHARING.md, "Put the next step on the card").
 */
export interface Shareable {
  /** the picture; leave out for a text-only share (the daily grid) */
  file?: File | null;
  /** the dare, in the sender's words: "I beat Tobi 3–1 on BoredGame. Your move:" */
  text: string;
  /** where the tap lands: a room, the daily, the game */
  url?: string;
}

const withLink = (s: Shareable) => (s.url ? `${s.text} ${s.url}` : s.text);

function viaLink(file: File) {
  // A blob: URL is same-origin and carries a real MIME type, so the download
  // attribute is honoured. Pointed at a data: URL it is not: Safari saves an
  // unnamed "Unknown" file and iOS ignores it entirely.
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url; a.download = file.name; a.rel = "noopener";
  document.body.appendChild(a); a.click(); a.remove();
  // Revoking immediately cancels the download in Safari, which reads the blob
  // after the click returns.
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/** Share a result. Returns what happened so the button can say so. */
export function shareResult(s: Shareable): Promise<"shared" | "saved" | "copied" | "cancelled"> {
  const text = withLink(s);
  const files = s.file ? [s.file] : undefined;
  if (files && navigator.canShare?.({ files, text })) {
    return navigator.share({ files, text }).then(() => "shared" as const, (e: unknown) => {
      if ((e as Error)?.name === "AbortError") return "cancelled" as const;
      viaLink(files[0]); return "saved" as const;
    });
  }
  if (!files && navigator.canShare?.({ text: s.text, url: s.url })) {
    return navigator.share({ text: s.text, url: s.url }).then(() => "shared" as const,
      (e: unknown) => ((e as Error)?.name === "AbortError" ? "cancelled" as const : copy(text)));
  }
  if (files) { viaLink(files[0]); void copy(text); return Promise.resolve("saved" as const); }
  return copy(text);
}

function copy(text: string): Promise<"copied" | "cancelled"> {
  return navigator.clipboard?.writeText(text).then(() => "copied" as const, () => "cancelled" as const)
    ?? Promise.resolve("cancelled" as const);
}

/** The old entry point, kept so a bare file still saves. */
export function saveCard(file: File) { void shareResult({ file, text: "" }); }
