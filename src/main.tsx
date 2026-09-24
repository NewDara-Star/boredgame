// First, so a failed sign-in link's reason is read before anything clears the address (F14).
import "@/shared/lib/linkError";
import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "@/app/App";
import "./index.css";

/**
 * A deploy renames every screen's file. A phone that opened the app before the
 * deploy still asks for the old names, the server has nothing to give it, and the
 * screen can't open. Vite fires this event when that happens: reload once and the
 * phone picks up the new build. The stamp stops a loop if the file is missing for
 * some other reason; without sessionStorage we don't risk a loop at all and let
 * the error screen (ErrorBoundary) offer the reload instead.
 */
window.addEventListener("vite:preloadError", (event) => {
  const KEY = "bg-reloaded-for-update";
  try {
    const last = Number(sessionStorage.getItem(KEY)) || 0;
    if (Date.now() - last < 10_000) return;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch { return; }
  event.preventDefault();
  window.location.reload();
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
