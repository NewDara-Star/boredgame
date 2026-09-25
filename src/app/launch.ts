/**
 * The launch (F1) is drawn in index.html, before any code arrives. This takes it
 * away: a 200 ms fade the moment the app knows who you are (AuthProvider has
 * read the saved login), or at once if the app crashes, so the error screen is
 * never hidden behind a flower. No minimum time.
 */
export function hideLaunch() {
  const el = document.getElementById("launch");
  if (!el || el.classList.contains("l-out")) return;
  el.classList.add("l-out");
  setTimeout(() => el.remove(), 250);
}
