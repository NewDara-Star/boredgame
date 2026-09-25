/**
 * You (#46–#51, F13): one tab for your profile, your rank and everyone else.
 * The old addresses keep working, because links to them are already out.
 */
import { readFileSync } from "node:fs";

let n = 0;
const ok = (c: boolean, m: string) => { n++; if (!c) { console.error("FAIL " + m); process.exit(1); } };
const src = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
const app = src("../src/app/App.tsx"), shell = src("../src/app/layout/Shell.tsx"), page = src("../src/features/profile/ProfilePage.tsx");

ok(/\{ to: "\/you", label: "You"/.test(shell) && !/label: "Ranks"/.test(shell), "the fourth tab is You");
for (const r of ['path="/you" element={<ProfilePage />}', 'path="/you/road" element={<RoadPage />}', 'path="/you/everyone" element={<LeaderboardPage />}'])
  ok(app.includes(r), `route ${r.split('"')[1]}`);
ok(/path="\/profile" element=\{<Navigate to="\/you" replace \/>\}/.test(app) && /path="\/ranks" element=\{<Navigate to="\/you\/everyone" replace \/>\}/.test(app),
   "old links (/profile, /ranks) still land in the right place");

const member = page.slice(page.indexOf("function MemberView()"), page.indexOf("function GuestYou()"));
ok(/<RankCard /.test(member) && /<Ladder /.test(member) && /<EveryoneCard /.test(member), "You: rank, the ladder to the road, where you stand (#46, #47)");
ok(member.indexOf("<SignOut ") > member.indexOf("<NotificationsCard"), "Sign out is last (#47)");
ok(/<NameSheet /.test(member) && /<PasswordSheet /.test(member) && /is free\./.test(page), "Change opens a one-field sheet, checked as you type (#50)");
ok(/Kept for 30 days after you last play\. Add a password to keep it for good/.test(page), "the guest screen says what really happens to their games (#51)");
ok(/I have an account/.test(page) && /Signing in leaves/.test(page), "a guest with an account can sign in, told what that leaves behind");

const home = src("../src/features/home/HomePage.tsx");
ok(/\{isGuest && !offline && \(/.test(home) && /Playing as a guest/.test(home), "Home asks a guest to keep their progress (#8)");
const road = src("../src/features/leaderboard/RoadPage.tsx");
ok(/Rank \{idx \+ 1\} of \{RANKS\.length\}/.test(road) && /friends=\{friends\}/.test(road), "the road names your rank and stands your friends on it (#48)");
ok(/Everyone/.test(src("../src/features/leaderboard/LeaderboardPage.tsx")) && /BackToYou/.test(road), "Everyone and the road lead back to You (#49)");

console.log(`${n} You assertions hold`);
