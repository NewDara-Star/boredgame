/**
 * The launch (F1) is drawn in index.html before any code arrives, so it carries
 * copies: the flower's two heads and the four skies. Copies drift; these can't.
 * And the app has to take it away, or it covers everything.
 */
import { readFileSync } from "node:fs";
import { SKIES } from "../src/shared/brand/tokens.ts";

let n = 0;
const ok = (c: boolean, m: string) => { n++; if (!c) { console.error("FAIL " + m); process.exit(1); } };
const src = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
const html = src("../index.html");

ok(/<div id="launch" aria-hidden="true">/.test(html) && html.indexOf('id="launch"') < html.indexOf('id="root"'),
   "the launch is in index.html, ahead of the app, so it paints before any code");
for (const [state, cls] of [["sleep", "l-sleep"], ["awake", "l-awake"]]) {
  const art = src(`../src/shared/brand/art/sfh-${state}.svg`).trim();
  const body = art.slice(art.indexOf(">") + 1);          // everything after the opening tag
  const at = html.indexOf(`class="l-f ${cls}"`);
  ok(at > 0 && html.slice(at).includes(body), `the ${state} head in index.html is the brand's sfh-${state}.svg`);
}
for (const [name, s] of Object.entries(SKIES)) {
  ok(html.includes(`["${name}", "${s.stops.join('", "')}"]`), `the ${name} sky matches tokens.ts`);
}
ok(/if \(!loading\) hideLaunch\(\)/.test(src("../src/app/providers/AuthProvider.tsx")), "it goes as soon as the saved login has been read");
ok(/hideLaunch\(\)/.test(src("../src/app/ErrorBoundary.tsx")), "a crash takes it away, so the error screen shows");
ok(/prefers-reduced-motion:reduce/.test(html), "reduced motion gets it still");
ok(!/setTimeout\([^)]*hideLaunch|min(imum)?Time/i.test(src("../src/app/launch.ts")), "no minimum time");

// F8: once the app is up, a screen's own code can still be on its way. The wait
// belongs in the page area, never above the header and nav.
const shell = src("../src/app/layout/Shell.tsx"), app = src("../src/app/App.tsx");
ok(/<Suspense fallback=\{<ScreenLoading \/>\}>\s*<Outlet \/>/.test(shell), "a screen loading waits inside the frame (header and nav stay)");
ok(!/<Suspense/.test(app), "nothing above Shell can blank the header and nav");
ok(/SHOW_AFTER_MS = 300/.test(src("../src/app/layout/ScreenLoading.tsx")), "a quick load shows nothing; the flower only after 0.3 s");

console.log(`${n} launch assertions hold`);
