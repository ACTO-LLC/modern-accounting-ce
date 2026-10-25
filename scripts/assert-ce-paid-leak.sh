#!/usr/bin/env bash
# Assert CE worktree has no paid seam markers or committed secrets.
# Aligns with SYNC.md + docs/architecture/ce-seams.md Phase 1b verify.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

fail=0

if [[ -f .env || -f .env.ce ]]; then
  echo "ERROR: committed or present .env / .env.ce in worktree (scrub before PR)"
  fail=1
fi

if ! command -v rg >/dev/null 2>&1; then
  echo "ERROR: ripgrep (rg) required"
  exit 2
fi

# Paid capability / secret markers (expect no matches outside docs that discuss policy)
PAT1='stripe|STRIPE_|books.?match|zero-touch|write-agent|multi-company|sk_live|sk_test|whsec_|ClaimId|Fluent.?MedOps|monitor.?agent|Entra|B2C'
PAT2='plaid-service|plaid-sync|GITHUB_TOKEN|monitor-agent'

# Allow policy docs to mention paid names; fail on code/config/env samples that enable them
mapfile -t hits < <(rg -n -i -e "$PAT1" -e "$PAT2" \
  --glob '!.git' \
  --glob '!docs/**' \
  --glob '!SYNC.md' \
  --glob '!NOTICE' \
  --glob '!LICENSE' \
  --glob '!scripts/assert-ce-paid-leak.sh' \
  --glob '!.env.ce.example' \
  . || true)

# .env.ce.example may list blocklist names in comments — scan for assignment forms only
mapfile -t env_hits < <(rg -n -i -e '^(export[[:space:]]+)?(STRIPE_|PLAID_|GITHUB_TOKEN)=' .env.ce.example || true)

if ((${#hits[@]})); then
  echo "ERROR: paid/leak markers outside allowed docs:"
  printf '%s\n' "${hits[@]}"
  fail=1
fi
if ((${#env_hits[@]})); then
  echo "ERROR: .env.ce.example assigns blocked secrets:"
  printf '%s\n' "${env_hits[@]}"
  fail=1
fi

# Compose must not define paid services
if rg -n -i -e '^\s*(monitor-agent|qbo-mcp)\s*:' docker-compose.ce.yml 2>/dev/null; then
  echo "ERROR: docker-compose.ce.yml defines paid/out-of-CE services"
  fail=1
fi

if [[ "$fail" -ne 0 ]]; then
  echo "assert-ce-paid-leak: FAIL"
  exit 1
fi
echo "assert-ce-paid-leak: OK"
