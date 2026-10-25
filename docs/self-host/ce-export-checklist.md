# CE one-shot export checklist (DevOps Slice A/B)

**Repos:** private `ACTO-LLC/modern-accounting` → public `ACTO-LLC/modern-accounting-ce`  
**Authority:** [ce-seams.md](../architecture/ce-seams.md), [SYNC.md](../../SYNC.md), ADR-0001 + CE vs paid matrix  
**Process:** Branch → PR → **Architect boundary review** → merge. No direct-to-main for runtime trees. No continuous mirror CI.

## Before copy

1. Record private source SHA (and optional tag).
2. Read path **allowlist / denylist** in `ce-seams.md`.
3. Confirm Developer strip (Phase 1b) landed for any runtime dirs you plan to copy — **Slice A does not strip code**.

## Copy

1. Copy **only** allowlisted paths.
2. Inside allowlisted dirs, **omit** file-level denylist (Plaid jobs, live QBO auth, Stripe, RCM adjudication, etc.).
3. Refresh `LICENSE`, `NOTICE`, `SYNC.md`, `docker-compose.ce.yml`, `.env.ce.example` if boundaries changed.
4. Do **not** copy: `monitor-agent/`, `infra/`, secrets, live `qbo-mcp-http-server/` (until approved), commercial license body.

## Scrub

- No `.env` / real Key Vault values / `sk_live` / `sk_test` / `whsec_` / agent write tokens.
- CE env = `.env.ce.example` placeholders only.

## Verify

```bash
./scripts/assert-ce-paid-leak.sh
```

Or manual `rg` from `SYNC.md` / `ce-seams.md`.

## PR

- Title: `ce: export <scope> from private@<sha>`
- Body: private SHA, allowlist used, assert output, Architect review request.

## Slice B notes (2026-10-25)

- Exported: `database/` (RCM/Plaid/payment-processing migrations + RCM-only tables/views omitted), `email-api/` (patient-statement / demand-package routes omitted), `csv-import-api/`, `dab-config.json` (+ development), `.devcontainer/Dockerfile.db-init`, `scripts/deploy-db.js`.
- Assert: word-boundary tokens; `database/` secret-only scan (shared schema family); skip `package-lock.json` integrity false positives; allow root `README.md`.

## chat-api/client export notes (2026-10-25)

- Private source: `38e9333c` (Dev 1b #726 strip/stub scaffolding).
- Prepared via private `scripts/ce-prepare-export-tree.sh` + `chat-api/src/ce/omit-manifest.json` (npm omits + CE-EXPORT-OMIT markers).
- Exported: stripped `chat-api/`, stripped `client/`, Compose `chat-api` + `client` under profile `app`, CE-safe `client/.env.example`, updated assert exclusions for `chat-api/src/ce/**` + `client/src/ce/**` + `chat-api/tests/ce-build.test.js`.
- **Not exported:** `monitor-agent/`, live QBO MCP, `ma-mcp`, paid npm packages (`plaid`, `@octokit/rest`, `react-plaid-link`, `@azure/msal-browser`, `@azure/msal-react`).
