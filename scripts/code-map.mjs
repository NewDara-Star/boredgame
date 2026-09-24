/**
 * The code map: every file, what it imports, what imports it, what it exports,
 * which of those exports anybody uses, which routes reach it, and every place it
 * touches the backend or the browser. Parsed with the TypeScript compiler, not
 * grepped, so a comment or a string can't fake an import.
 *
 *   node scripts/code-map.mjs            summary to stdout
 *   node scripts/code-map.mjs --json F   the whole map as JSON, for the sweep
 *
 * It answers "is this used, and by which screen" the same way every time, which
 * is what an area-by-area sweep needs before anyone reads a line.
 */
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const ROOT = process.cwd();
const rel = (p) => path.relative(ROOT, p).split(path.sep).join("/");
const walk = (d, out = []) => {
  if (!fs.existsSync(d)) return out;
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (!["node_modules", ".temp"].includes(e.name)) walk(p, out); }
    else if (/\.(tsx?|mts|mjs|js|json|css|svg)$/.test(e.name)) out.push(p);
  }
  return out;
};
const FILES = [...walk("src"), ...walk("api"), ...walk("supabase/functions"), ...walk("scripts"), ...walk("public")]
  .map((p) => path.resolve(p)).filter((p) => !/scripts\/_/.test(rel(p)));
const CODE = FILES.filter((p) => /\.(tsx?|mts|mjs|js)$/.test(p));
const EXISTS = new Set(FILES.map(rel));

function resolve(from, spec) {
  spec = spec.replace(/\?.*$/, "");
  let base;
  if (spec.startsWith("@/")) base = path.join(ROOT, "src", spec.slice(2));
  else if (spec.startsWith(".")) base = path.resolve(path.dirname(from), spec);
  else return { ext: spec.split("/").slice(0, spec.startsWith("@") ? 2 : 1).join("/") };
  for (const c of [base, base + ".ts", base + ".tsx", base + ".mts", base + ".js", base + "/index.ts", base + "/index.tsx"]) {
    if (EXISTS.has(rel(c)) && fs.statSync(c).isFile()) return { file: rel(c) };
  }
  return { missing: rel(base) };
}

const lineOf = (sf, node) => sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
const map = {};
for (const abs of CODE) {
  const f = rel(abs), src = fs.readFileSync(abs, "utf8");
  const sf = ts.createSourceFile(f, src, ts.ScriptTarget.Latest, true, f.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const m = map[f] = { lines: src.split("\n").length, imports: [], exports: [], decls: [], backend: [], browser: [], ext: new Set(), jsx: new Set() };
  const addImport = (spec, names, typeOnly, line) => {
    const r = resolve(abs, spec);
    if (r.ext) { m.ext.add(r.ext); return; }
    m.imports.push({ spec, file: r.file ?? null, missing: r.missing ?? null, names, typeOnly, line });
  };
  const visit = (n) => {
    if (ts.isImportDeclaration(n) && ts.isStringLiteral(n.moduleSpecifier)) {
      const c = n.importClause, names = [];
      if (c?.name) names.push("default");
      if (c?.namedBindings) {
        if (ts.isNamespaceImport(c.namedBindings)) names.push("*");
        else for (const e of c.namedBindings.elements) names.push((e.propertyName ?? e.name).text);
      }
      addImport(n.moduleSpecifier.text, names, !!c?.isTypeOnly, lineOf(sf, n));
    }
    if (ts.isExportDeclaration(n)) {
      if (n.moduleSpecifier && ts.isStringLiteral(n.moduleSpecifier)) {
        const names = n.exportClause && ts.isNamedExports(n.exportClause) ? n.exportClause.elements.map((e) => (e.propertyName ?? e.name).text) : ["*"];
        addImport(n.moduleSpecifier.text, names, n.isTypeOnly, lineOf(sf, n));
        if (n.exportClause && ts.isNamedExports(n.exportClause)) for (const e of n.exportClause.elements) m.exports.push({ name: e.name.text, line: lineOf(sf, n), reexport: true });
      } else if (n.exportClause && ts.isNamedExports(n.exportClause)) {
        for (const e of n.exportClause.elements) m.exports.push({ name: e.name.text, line: lineOf(sf, n) });
      }
    }
    if (ts.isCallExpression(n)) {
      const t = n.expression.getText(sf), a0 = n.arguments[0], s0 = a0 && ts.isStringLiteralLike(a0) ? a0.text : null;
      if (n.expression.kind === ts.SyntaxKind.ImportKeyword && s0) addImport(s0, ["*"], false, lineOf(sf, n));
      if (/import\.meta\.glob$/.test(t) && s0) m.imports.push({ spec: s0, glob: true, file: null, names: ["*"], line: lineOf(sf, n) });
      const L = lineOf(sf, n);
      if (/\.rpc$/.test(t) && s0) m.backend.push({ kind: "rpc", name: s0, line: L });
      else if (/\.from$/.test(t) && /supabase|sb\b|client/.test(t)) m.backend.push({ kind: "table", name: s0 ?? "(dynamic) " + (a0?.getText(sf) ?? "?"), line: L });
      else if (/functions\.invoke$/.test(t) && s0) m.backend.push({ kind: "edge", name: s0, line: L });
      else if (/\.channel$/.test(t)) m.backend.push({ kind: "channel", name: s0 ?? a0?.getText(sf) ?? "?", line: L });
      else if (/\.storage\.from$/.test(t) && s0) m.backend.push({ kind: "storage", name: s0, line: L });
      else if (/^fetch$/.test(t)) m.backend.push({ kind: "fetch", name: a0?.getText(sf).slice(0, 60) ?? "?", line: L });
      else if (/\.auth\.\w+$/.test(t)) m.backend.push({ kind: "auth", name: t.replace(/^.*\.auth\./, ""), line: L });
      const B = t.match(/^(?:window\.)?(navigator\.\w+(?:\.\w+)?|localStorage\.\w+|sessionStorage\.\w+|setInterval|setTimeout|requestAnimationFrame|new (?:WebSocket|RTCPeerConnection|Notification))/);
      if (B) m.browser.push({ api: B[1], line: L, arg: /Storage/.test(B[1]) && a0 ? a0.getText(sf).slice(0, 50) : undefined });
    }
    if (ts.isNewExpression(n) && /RTCPeerConnection|WebSocket|Audio|MediaRecorder|Worker/.test(n.expression.getText(sf))) m.browser.push({ api: "new " + n.expression.getText(sf), line: lineOf(sf, n) });
    if (ts.isJsxOpeningLikeElement(n)) { const tag = n.tagName.getText(sf); if (/^[A-Z]/.test(tag)) m.jsx.add(tag.split(".")[0]); }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  // named functions declared inside a top-level one: handlers, callbacks, effects' helpers
  const innerOf = (top) => {
    const out = [];
    const walk = (n, depth) => {
      if (n !== top && (ts.isFunctionDeclaration(n) && n.name)) out.push({ name: n.name.text, line: lineOf(sf, n) });
      if (ts.isVariableDeclaration(n) && n.parent?.parent !== top && n.initializer && ts.isIdentifier(n.name)) {
        const i = n.initializer, t = i.getText(sf);
        if (ts.isArrowFunction(i) || ts.isFunctionExpression(i) || /^use(Callback|Memo)\(/.test(t)) out.push({ name: n.name.text, line: lineOf(sf, n) });
      }
      if (ts.isCallExpression(n) && /^use(Layout)?Effect$/.test(n.expression.getText(sf))) out.push({ name: "effect", line: lineOf(sf, n) });
      ts.forEachChild(n, (c) => walk(c, depth + 1));
    };
    ts.forEachChild(top, (c) => walk(c, 1));
    return out;
  };
  // top-level declarations
  for (const s of sf.statements) {
    const exp = ts.canHaveModifiers(s) && ts.getModifiers(s)?.some((x) => x.kind === ts.SyntaxKind.ExportKeyword);
    const dflt = ts.canHaveModifiers(s) && ts.getModifiers(s)?.some((x) => x.kind === ts.SyntaxKind.DefaultKeyword);
    const push = (name, kind) => {
      m.decls.push({ name, kind, line: lineOf(sf, s), end: sf.getLineAndCharacterOfPosition(s.getEnd()).line + 1, exported: !!exp, inner: innerOf(s) });
      if (exp) m.exports.push({ name: dflt ? "default" : name, line: lineOf(sf, s), kind });
    };
    if (ts.isFunctionDeclaration(s)) push(s.name?.text ?? "default", /^use[A-Z]/.test(s.name?.text ?? "") ? "hook" : /^[A-Z]/.test(s.name?.text ?? "") ? "component" : "function");
    else if (ts.isClassDeclaration(s)) push(s.name?.text ?? "default", "class");
    else if (ts.isInterfaceDeclaration(s) || ts.isTypeAliasDeclaration(s)) push(s.name.text, "type");
    else if (ts.isEnumDeclaration(s)) push(s.name.text, "enum");
    else if (ts.isVariableStatement(s)) for (const d of s.declarationList.declarations) {
      const nm = d.name.getText(sf), init = d.initializer;
      const fn = init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init));
      push(nm, fn ? (/^use[A-Z]/.test(nm) ? "hook" : /^[A-Z]/.test(nm) && init.getText(sf).includes("<") ? "component" : "function") : "const");
    }
    else if (ts.isExportAssignment(s)) m.exports.push({ name: "default", line: lineOf(sf, s) });
  }
  m.ext = [...m.ext]; m.jsx = [...m.jsx];
}

// ---- globs resolve to the files they match
for (const [f, m] of Object.entries(map)) for (const im of m.imports) if (im.glob) {
  const dir = path.dirname(f), rx = new RegExp("^" + path.posix.join(dir, im.spec).replace(/\./g, "\\.").replace(/\*/g, "[^/]*") + "$");
  im.files = [...EXISTS].filter((x) => rx.test(x));
}

// ---- reverse edges and export use
const importedBy = {}, usedNames = {};
for (const [f, m] of Object.entries(map)) for (const im of m.imports) {
  for (const t of im.files ?? (im.file ? [im.file] : [])) {
    (importedBy[t] ??= []).push(f);
    const u = (usedNames[t] ??= {});
    for (const n of im.names) (u[n] ??= []).push(f);
  }
}
// names re-exported through a barrel count as used when the barrel's name is used
for (const [f, m] of Object.entries(map)) for (const im of m.imports) if (im.file && m.exports.some((e) => e.reexport && im.names.includes(e.name))) {
  for (const n of im.names) if ((usedNames[f] ?? {})[n]) ((usedNames[im.file] ??= {})[n] ??= []).push(...usedNames[f][n]);
}

// ---- entries and reachability
const ENTRIES = { app: "src/main.tsx", contact: "src/contact.tsx", "service worker": "public/push-sw.js" };
for (const f of Object.keys(map)) {
  if (f.startsWith("api/")) ENTRIES["vercel " + f] = f;
  if (/^supabase\/functions\/[^/]+\/index\.ts$/.test(f)) ENTRIES["edge " + f.split("/")[2]] = f;
  if (/^scripts\//.test(f)) ENTRIES["script " + path.basename(f)] = f;
}
const closure = (start, runtimeOnly = true) => {
  const seen = new Set(), st = [start];
  while (st.length) { const f = st.pop(); if (seen.has(f)) continue; seen.add(f);
    for (const im of map[f]?.imports ?? []) if (!(runtimeOnly && im.typeOnly)) for (const t of im.files ?? (im.file ? [im.file] : [])) st.push(t); }
  return seen;
};
const reach = {};
for (const [name, f] of Object.entries(ENTRIES)) for (const x of closure(f)) (reach[x] ??= []).push(name);

// ---- routes: App.tsx <Route path element={<X />}> -> the file X comes from
const routes = [];
const app = fs.readFileSync("src/app/App.tsx", "utf8");
for (const r of app.matchAll(/<Route\s+path="([^"]+)"\s+element=\{<(\w+)/g)) {
  const comp = r[2];
  const lazySpec = app.match(new RegExp(`const ${comp} = lazy\\(\\(\\) => import\\("([^"]+)"`))?.[1];
  const im = lazySpec ? map["src/app/App.tsx"].imports.find((i) => i.spec === lazySpec)
    : map["src/app/App.tsx"].imports.find((i) => i.names.includes(comp) && !i.typeOnly);
  routes.push({ path: r[1], component: comp, file: im?.file ?? null });
}
const byRoute = {};
for (const r of routes) if (r.file) for (const x of closure(r.file)) (byRoute[x] ??= []).push(r.path);

// ---- the backend as schema.sql declares it
const sql = fs.readFileSync("supabase/schema.sql", "utf8");
const sqlTables = [...new Set([...sql.matchAll(/create (?:table|(?:or replace )?view|materialized view) (?:if not exists )?(?:public\.)?(\w+)/gi)].map((x) => x[1]).filter((n) => !/^(as|if|not)$/i.test(n)))];
const sqlFns = [...new Set([...sql.matchAll(/create (?:or replace )?function (?:public\.)?(\w+)\s*\(/gi)].map((x) => x[1]))];
const realtime = [...sql.matchAll(/alter publication supabase_realtime add table (?:public\.)?(\w+)/gi)].map((x) => x[1]);
const cron = [...sql.matchAll(/cron\.schedule\(\s*'([^']+)'/gi)].map((x) => x[1]);
const called = {};
for (const [f, m] of Object.entries(map)) for (const b of m.backend) (called[b.kind + ":" + b.name] ??= []).push(`${f}:${b.line}`);
// a call from SQL: the name followed by "(" anywhere except its own definition, a grant/revoke/drop/comment line
const sqlBody = sql.split("\n").filter((l) => !/^\s*--/.test(l) && !/\b(grant|revoke|drop function|comment on function|create (or replace )?function)\b/i.test(l)).join("\n");
const sqlUses = (name) => (sqlBody.match(new RegExp(`\\b${name}\\s*\\(`, "g")) ?? []).length
  + (sqlBody.match(new RegExp(`execute (?:procedure|function) (?:public\\.)?${name}\\b`, "gi")) ?? []).length;

// ---- verdicts
const report = { routes, entries: ENTRIES, files: {} };
for (const [f, m] of Object.entries(map)) {
  const u = usedNames[f] ?? {};
  const star = !!u["*"];
  report.files[f] = {
    lines: m.lines, reachedFrom: reach[f] ?? [], routes: [...new Set(byRoute[f] ?? [])],
    importedBy: [...new Set(importedBy[f] ?? [])],
    exports: m.exports.map((e) => {
      const usedBy = star ? ["*"] : [...new Set(u[e.name] ?? [])];
      const src = fs.readFileSync(f, "utf8");
      const inside = e.name !== "default" && (src.match(new RegExp(`\\b${e.name}\\b`, "g")) ?? []).length > 1;
      return { ...e, usedBy, verdict: usedBy.length ? "used" : inside ? "export not needed" : "unused" };
    }),
    decls: m.decls, backend: m.backend, browser: m.browser, ext: m.ext, jsx: m.jsx,
    missingImports: m.imports.filter((i) => i.missing).map((i) => i.spec),
  };
}
const nonCode = FILES.map(rel).filter((f) => !map[f]);
report.assets = nonCode.map((f) => ({ file: f, importedBy: [...new Set(importedBy[f] ?? [])] }));
report.backend = {
  tables: sqlTables.map((t) => ({ name: t, clientUses: called["table:" + t] ?? [], realtime: realtime.includes(t) })),
  functions: sqlFns.map((n) => ({ name: n, clientCalls: called["rpc:" + n] ?? [], sqlCalls: sqlUses(n) })),
  edge: Object.keys(ENTRIES).filter((k) => k.startsWith("edge ")).map((k) => ({ name: k.slice(5), invokedFrom: called["edge:" + k.slice(5)] ?? [] })),
  unknownRpc: Object.keys(called).filter((k) => k.startsWith("rpc:") && !sqlFns.includes(k.slice(4))),
  unknownTables: Object.keys(called).filter((k) => k.startsWith("table:") && !sqlTables.includes(k.slice(6))),
  cron,
};

const out = process.argv.indexOf("--json");
if (out > 0) fs.writeFileSync(process.argv[out + 1], JSON.stringify(report, null, 1));
const F = report.files, app_ = Object.keys(F).filter((f) => F[f].reachedFrom.includes("app"));
const typesOnly = (f) => F[f].decls.length && F[f].decls.every((d) => d.kind === "type");
const orphan = Object.keys(F).filter((f) => !F[f].reachedFrom.length && f.startsWith("src/") && !f.endsWith(".d.ts") && !typesOnly(f));
const deadExports = Object.entries(F).filter(([f]) => f.startsWith("src/")).flatMap(([f, x]) => x.exports.filter((e) => e.verdict === "unused").map((e) => `${f}:${e.line} ${e.name} (${e.kind ?? "?"})`));
const loose = Object.entries(F).filter(([f]) => f.startsWith("src/")).flatMap(([f, x]) => x.exports.filter((e) => e.verdict === "export not needed")).length;
console.log(`files ${Object.keys(F).length} (${app_.length} in the app bundle), ${Object.values(F).reduce((a, x) => a + x.lines, 0)} lines`);
console.log(`routes ${routes.length}; entries ${Object.keys(ENTRIES).length}`);
console.log(`src files nothing reaches: ${orphan.length}`); orphan.forEach((f) => console.log("  " + f));
console.log(`exported but only used inside their own file: ${loose}`);
console.log(`exports used nowhere at all: ${deadExports.length}`); deadExports.forEach((x) => console.log("  " + x));
const B = report.backend;
console.log(`tables ${B.tables.length}, sql functions ${B.functions.length}, edge functions ${B.edge.length}`);
console.log(`sql functions nothing calls (client or sql): ${B.functions.filter((x) => !x.clientCalls.length && x.sqlCalls <= 0).map((x) => x.name).join(", ") || "none"}`);
console.log(`client calls with no sql definition: ${[...B.unknownRpc, ...B.unknownTables].join(", ") || "none"}`);
console.log(`missing imports: ${Object.entries(F).filter(([, x]) => x.missingImports.length).map(([f, x]) => f + " -> " + x.missingImports).join("; ") || "none"}`);
