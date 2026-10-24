# Syncing private → Community Edition (manual one-shot)

**Private source:** `ACTO-LLC/modern-accounting`  
**Public CE:** `ACTO-LLC/modern-accounting-ce`  
**Cadence:** Manual. **No automated mirror CI** yet.  
**Policy:** [ADR-0001](./docs/architecture/adr-0001-open-core-community-edition.md) (Accepted) + [CE vs paid matrix](./docs/prd/ce-vs-paid-feature-matrix.md)  
**Seams (Phase 1a):** Path allow/deny, stub contracts, and Compose target live in private [`docs/architecture/ce-seams.md`](https://github.com/ACTO-LLC/modern-accounting/blob/main/docs/architecture/ce-seams.md) (mirrored below after merge). A copy may also land at `docs/architecture/ce-seams.md` in this repo when the private PR merges.

## When to sync

- After CE-safe fixes land on private `main`
- Before a tagged CE release (`ce-vX.Y.Z`)
- When Architect/DevOps opens a Phase N export ticket (**PR → Architect review → merge**)

## One-shot procedure

1. Check out a clean private `main` (or release tag). Record the private commit SHA.
2. Copy **only** the CE allowlist from `ce-seams.md` — do **not** mirror the full monorepo.
3. Inside allowlisted dirs, **omit/stub** file-level denylist entries (Plaid jobs, live QBO auth, Stripe, RCM adjudication, etc.).
4. Refresh root `LICENSE` (AGPL-3.0), `NOTICE`, and this `SYNC.md` if the strip list changed.
5. Keep CE `README.md` CE-only.
6. Scrub secrets; open a PR on `modern-accounting-ce` → Architect review → merge.

## Path allowlist (summary)

| Path | Notes |
|------|--------|
| `database/` | Core schema; strip paid-only migrations if any |
| `client/` | Strip paid UI |
| `chat-api/` | Strip paid modules (Plaid, live QBO, Stripe, RCM join adapters) |
| `csv-import-api/` | CE |
| `email-api/` | Basic SMTP |
| `dab-config*.json` | Review entities |
| `.devcontainer/` (db-init as needed) | Compose init |
| `docs/` CE subset | ADR, matrix, self-host scripts-only |
| `scripts/` CE-safe | #630 scripts-only |
| Root CE license/Compose/env | Already present |

**Optional / deferred:** `ma-mcp-server/` (if read-only CE-safe); one-shot QBO; never `monitor-agent/`, `infra/`, live `qbo-mcp-http-server/` until approved.

## Path denylist (never sync)

`monitor-agent/`, `infra/`, `functions/` (default until proven CE-safe), live QBO MCP server, secrets, commercial license body.

## Stub policy

Prefer **export omit** over UI-only hide. Shared leftovers → CE no-op facade, **no** paid SDKs/secrets.

## Compose target (Phase 1b)

**In:** database, db-init, dab, email-api, csv-import-api (as applicable), chat-api (stripped), client (stripped).  
**Out:** monitor-agent, qbo-mcp (unless one-shot approved), managed cloud control plane.

## Architecture rules (ADR)

1. One schema family — no permanent CE DB fork.
2. CE builds **strip or stub** paid packages — not UI-only hides.
3. No Stripe secrets, payment webhooks, agent GitHub write paths, or RCM join adapters as dead code in CE.
4. No automated private→public mirror CI in Phase 1a.

## Verify before merge

```bash
rg -i 'stripe|STRIPE_|books.?match|zero-touch|write-agent|multi-company|sk_live|sk_test|whsec_|ClaimId|RCM|Fluent.?MedOps|monitor.?agent|Entra|B2C' --glob '!.git'
rg -i 'plaid-service|plaid-sync|GITHUB_TOKEN|monitor-agent' --glob '!.git'
test ! -f .env || (echo 'ERROR: .env present' && exit 1)
```

## Versioning

- Tag CE releases as `ce-vX.Y.Z`
- Record private source commit SHA in the CE PR description (optional: `SYNC-SOURCE.txt`)

