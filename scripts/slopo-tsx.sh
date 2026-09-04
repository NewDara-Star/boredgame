#!/usr/bin/env bash
# slopo 0.7.0 indexes .ts but not .tsx, so on this repo it sees 29 of 82 files
# and every component is skipped in silence. tree-sitter-typescript already
# ships the JSX grammar; this points a parser at it. Also adds .mts/.mjs.
#
# A local patch to an installed package: `uv tool upgrade slopo` undoes it, so
# re-run it after upgrading, or drop it once upstream supports .tsx.
set -euo pipefail

BIN=$(command -v slopo) || { echo "slopo not on PATH — uv tool install slopo"; exit 1; }
# uv installs slopo in its own venv, so the system python cannot import it.
# The executable's shebang names the interpreter that can.
PY=$(head -1 "$BIN" | sed 's/^#!//')
[ -x "$PY" ] || { echo "could not find slopo's interpreter from $BIN"; exit 1; }

D=$("$PY" -c 'import importlib.util,pathlib;print(pathlib.Path(importlib.util.find_spec("slopo").origin).parent/"indexing"/"parsing")')
[ -d "$D" ] || { echo "no parsing package at $D"; exit 1; }

sed 's/language_typescript()/language_tsx()/' "$D/lang/typescript.py" > "$D/lang/tsx.py"
"$PY" - "$D/registry.py" <<'PY'
import sys
p = sys.argv[1]; s = open(p).read()
if '".tsx"' in s:
    print("registry already patched"); raise SystemExit
s = s.replace("    typescript,\n    kotlin,", "    typescript,\n    tsx,\n    kotlin,")
s = s.replace('    ".ts": typescript.parse,\n}',
              '    ".ts": typescript.parse,\n    ".mts": typescript.parse,\n'
              '    ".mjs": javascript.parse,\n    ".tsx": tsx.parse,\n    ".jsx": tsx.parse,\n}')
assert '".tsx"' in s and "    tsx,\n" in s, "slopo's source changed shape — patch by hand"
open(p, "w").write(s)
print("patched", p)
PY
echo
echo "Done. Now:  rm -f slopo.db && slopo index      # expect 79 files, not 29"
