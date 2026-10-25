#!/usr/bin/env bash
# Developer Phase 1b — prepare a temporary stripped chat-api+client tree for CE verify.
# Does NOT push to modern-accounting-ce. Uses chat-api/src/ce/omit-manifest.json.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${1:-/tmp/ma-ce-strip-verify}"
MANIFEST="$ROOT/chat-api/src/ce/omit-manifest.json"

if [[ ! -f "$MANIFEST" ]]; then
  echo "ERROR: missing $MANIFEST"
  exit 2
fi

rm -rf "$OUT"
mkdir -p "$OUT"

echo "Copying chat-api + client into $OUT ..."
cp -a "$ROOT/chat-api" "$OUT/chat-api"
cp -a "$ROOT/client" "$OUT/client"

python3 - "$MANIFEST" "$OUT" <<'PY'
import json, os, sys, glob, shutil, re
manifest_path, out = sys.argv[1], sys.argv[2]
with open(manifest_path) as f:
    m = json.load(f)

def omit(base, patterns):
    for pat in patterns:
        full = os.path.join(base, pat)
        matches = glob.glob(full)
        if os.path.isdir(full) and not matches:
            matches = [full]
        if not matches and "*" not in pat and os.path.exists(full):
            matches = [full]
        for path in matches:
            if os.path.isdir(path):
                shutil.rmtree(path)
                print(f"  omit dir  {path}")
            elif os.path.exists(path):
                os.remove(path)
                print(f"  omit file {path}")
            else:
                print(f"  skip missing {path}")

def npm_omit(pkg_json_path, packages):
    if not packages or not os.path.isfile(pkg_json_path):
        return
    with open(pkg_json_path) as f:
        pkg = json.load(f)
    removed = []
    for section in ("dependencies", "devDependencies", "optionalDependencies", "peerDependencies"):
        deps = pkg.get(section) or {}
        for name in packages:
            if name in deps:
                del deps[name]
                removed.append(f"{section}:{name}")
        if section in pkg and not deps:
            # keep empty dict or drop — keep for stability
            pkg[section] = deps
    with open(pkg_json_path, "w") as f:
        json.dump(pkg, f, indent=2)
        f.write("\n")
    for r in removed:
        print(f"  npm omit {r} from {pkg_json_path}")
    if not removed:
        print(f"  npm omit: nothing to remove in {pkg_json_path}")

def strip_export_omit_markers(path):
    if not os.path.isfile(path):
        return
    text = open(path, encoding="utf-8").read()
    orig = text
    # Remove CE-EXPORT-OMIT-BEGIN ... CE-EXPORT-OMIT-END blocks (incl. markers)
    text = re.sub(
        r"[ \t]*// CE-EXPORT-OMIT-BEGIN.*?// CE-EXPORT-OMIT-END\n?",
        "",
        text,
        flags=re.S,
    )
    # Remove single lines tagged CE-EXPORT-OMIT-LINE (tag line + following line)
    text = re.sub(
        r"[ \t]*// CE-EXPORT-OMIT-LINE\n[^\n]*\n",
        "",
        text,
    )
    if text != orig:
        open(path, "w", encoding="utf-8").write(text)
        print(f"  stripped CE-EXPORT-OMIT regions in {path}")

print("Omitting chat-api paid paths:")
omit(os.path.join(out, "chat-api"), m["chatApiOmit"])
print("Omitting client paid paths:")
omit(os.path.join(out, "client"), m["clientOmit"])

print("Applying npm omits:")
npm_omit(os.path.join(out, "chat-api", "package.json"), m.get("chatApiNpmOmit") or [])
npm_omit(os.path.join(out, "client", "package.json"), m.get("clientNpmOmit") or [])

print("Stripping CE-EXPORT-OMIT markers:")
strip_export_omit_markers(os.path.join(out, "chat-api", "server.js"))
PY

if [[ -f "$OUT/client/src/ce/paid-ui.ce.ts" ]]; then
  cp -f "$OUT/client/src/ce/paid-ui.ce.ts" "$OUT/client/src/ce/paid-ui.ts"
  echo "  client paid-ui.ts <- paid-ui.ce.ts (CE default)"
fi

echo "Prepared strip tree at $OUT"
echo "Next: run assert against a CE-shaped checkout, or rg denylist on $OUT/chat-api + $OUT/client."
