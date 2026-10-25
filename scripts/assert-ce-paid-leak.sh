#!/usr/bin/env bash
# Assert CE worktree has no paid seam markers or committed secrets.
# Aligns with SYNC.md + docs/architecture/ce-seams.md Phase 1b verify.
# Slice B: word-boundary tokens; skip lockfile hashes; README/SYNC policy OK;
# database/ is shared schema family — secret-only scan there (not Entra*/B2C* column ids).
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

PAT1='stripe|STRIPE_|books[- ]?match|zero-touch|write-agent|multi-company|sk_live|sk_test|whsec_|\bClaimId\b|\bRCM\b|Fluent[- ]?MedOps|monitor[- ]?agent|\bEntra\b|\bB2C\b'
PAT2='plaid-service|plaid-sync|GITHUB_TOKEN|monitor-agent'
# Secrets / paid SDK markers only (database shared schema may mention Entra*/ClaimId columns)
PAT_DB='sk_live|sk_test|whsec_|STRIPE_|plaid-service|plaid-sync|GITHUB_TOKEN|monitor-agent'

mapfile -t hits < <(rg -n -i -e "$PAT1" -e "$PAT2" \
  --glob '!.git' \
  --glob '!docs/**' \
  --glob '!SYNC.md' \
  --glob '!SYNC-SOURCE.txt' \
  --glob '!NOTICE' \
  --glob '!LICENSE' \
  --glob '!README.md' \
  --glob '!scripts/assert-ce-paid-leak.sh' \
  --glob '!.env.ce.example' \
  --glob '!**/package-lock.json' \
  --glob '!database/**' \
  --glob '!chat-api/src/ce/**' \
  --glob '!client/src/ce/**' \
  --glob '!chat-api/tests/ce-build.test.js' \
  . || true)

mapfile -t db_hits < <(rg -n -i -e "$PAT_DB" \
  --glob '!.git' \
  --glob '!**/package-lock.json' \
  database 2>/dev/null || true)

mapfile -t env_hits < <(rg -n -i -e '^(export[[:space:]]+)?(STRIPE_|PLAID_|GITHUB_TOKEN)=' .env.ce.example || true)

if ((${#hits[@]})); then
  echo "ERROR: paid/leak markers outside allowed docs:"
  printf '%s\n' "${hits[@]}"
  fail=1
fi
if ((${#db_hits[@]})); then
  echo "ERROR: secret/paid-SDK markers in database/:"
  printf '%s\n' "${db_hits[@]}"
  fail=1
fi
if ((${#env_hits[@]})); then
  echo "ERROR: .env.ce.example assigns blocked secrets:"
  printf '%s\n' "${env_hits[@]}"
  fail=1
fi

if rg -n -i -e '^\s*(monitor-agent|qbo-mcp)\s*:' docker-compose.ce.yml 2>/dev/null; then
  echo "ERROR: docker-compose.ce.yml defines paid/out-of-CE services"
  fail=1
fi

if [[ "$fail" -ne 0 ]]; then
  echo "assert-ce-paid-leak: FAIL"
  exit 1
fi
echo "assert-ce-paid-leak: OK"
