import { Component, type ReactNode } from "react";

/**
 * Without this, one bad row anywhere unmounts the entire tree — the leaderboard
 * crashed on a profile with no username and took the header and the nav with it,
 * so there was not even a way to navigate off the broken screen.
 */
/** The messages browsers give when a module or its CSS can't be fetched. */
const STALE = /dynamically imported module|importing a module script failed|error loading dynamically imported|unable to preload css|expected a javascript module/i;
const isStaleBuild = (e: Error) => STALE.test(e.message) || e.name === "ChunkLoadError";

export class ErrorBoundary extends Component<
  { children: ReactNode; onReset?: () => void },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) { return { error }; }

  componentDidCatch(error: Error) {
    // Deliberately console, not a toast: this is for whoever is debugging it.
    console.error("[BoredGame] screen crashed:", error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    // A screen whose file vanished in a deploy. React remembers the failed load, so
    // "Try again" would fail forever; only a real reload fetches the new build.
    if (isStaleBuild(this.state.error)) {
      return (
        <div className="card p-6">
          <h1 className="font-display text-2xl font-semibold">There's a new version</h1>
          <p className="text-sm text-soft font-semibold mt-2">
            BoredGame was updated while you had it open. Reload to get it.
          </p>
          <button onClick={() => window.location.reload()}
            className="cut tap w-full mt-5 py-3.5 font-display text-lg font-semibold cut-petal">
            Reload
          </button>
        </div>
      );
    }
    return (
      <div className="card p-6">
        <h1 className="font-display text-2xl font-semibold">This screen fell over</h1>
        <p className="text-sm text-soft font-semibold mt-2">
          Something on this page hit a value it did not expect. The rest of the app is fine —
          the tabs at the bottom still work.
        </p>
        <button
          onClick={() => { this.setState({ error: null }); this.props.onReset?.(); }}
          className="cut tap w-full mt-5 py-3.5 font-display text-lg font-semibold cut-petal">
          Try again
        </button>
      </div>
    );
  }
}
