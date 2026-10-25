# Syncing private → Community Edition (manual one-shot)

**Private source:** `ACTO-LLC/modern-accounting`  
**Public CE:** `ACTO-LLC/modern-accounting-ce`  
**Cadence:** Manual. **No automated mirror CI** yet.  
**Policy:** [ADR-0001](./docs/architecture/adr-0001-open-core-community-edition.md) (Accepted) + [CE vs paid matrix](./docs/prd/ce-vs-paid-feature-matrix.md)  
**Seams (Phase 1a):** [docs/architecture/ce-seams.md](./docs/architecture/ce-seams.md) (mirrored from private) — path allow/deny, stub contracts, Compose target.

## When to sync

- After CE-safe fixes land on private `main`
- Before a tagged CE release (`ce-vX.Y.Z`)
- When Architect/DevOps opens a Phase N export ticket (**PR → Architect review → merge**)

## One-shot procedure

1. Check out a clean private `main` (or release tag). Record the private commit SHA.
2. Follow [docs/self-host/ce-export-checklist.md](./docs/self-host/ce-export-checklist.md).
3. Copy **only** the CE allowlist from `ce-seams.md` — do **not** mirror the full monorepo.
4. Inside allowlisted dirs, **omit/stub** file-level denylist entries (Plaid jobs, live QBO auth, Stripe, RCM adjudication, etc.).
5. Refresh root `LICENSE` (AGPL-3.0), `NOTICE`, and this `SYNC.md` if the strip list changed.
6. Keep CE `README.md` CE-only.
7. Scrub secrets; run `./scripts/assert-ce-paid-leak.sh`; open a PR → Architect review → merge.

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
| `docs/` CE subset | ADR, matrix, seams, self-host scripts-only |
| `scripts/` CE-safe | #630 scripts-only + `assert-ce-paid-leak.sh` |
| Root CE license/Compose/env | `LICENSE`, `NOTICE`, `SYNC.md`, `docker-compose.ce.yml`, `.env.ce.example` |

**Optional / deferred:** `ma-mcp-server/` (if read-only CE-safe); one-shot QBO; never `monitor-agent/`, `infra/`, live `qbo-mcp-http-server/` until approved.

## Path denylist (never sync)

`monitor-agent/`, `infra/`, `functions/` (default until proven CE-safe), live QBO MCP server, secrets, commercial license body.

## Stub policy

Prefer **export omit** over UI-only hide. Shared leftovers → CE no-op facade, **no** paid SDKs/secrets. CE builds **strip or stub** paid packages — not UI-only hides; no dead Stripe/RCM/agent adapters in the CE tree.

## Compose target (Slice B runtime export)

**In (exported):** database, db-init, dab, email-api, csv-import-api.  
**HOLD (not exported — needs Dev 1b strip):** chat-api, client.  
**Out:** monitor-agent, qbo-mcp (unless one-shot approved), managed cloud control plane, ma-mcp (until Architect review).

See `docker-compose.ce.yml` + `docs/self-host/ce-boot.md`. Private source SHA: `SYNC-SOURCE.txt`.

## Verify before merge

```bash
./scripts/assert-ce-paid-leak.sh
```

Manual equivalent:

```bash
rg -i 'stripe|STRIPE_|books.?match|zero-touch|write-agent|multi-company|sk_live|sk_test|whsec_|ClaimId|RCM|Fluent.?MedOps|monitor.?agent|Entra|B2C' --glob '!.git'
rg -i 'plaid-service|plaid-sync|GITHUB_TOKEN|monitor-agent' --glob '!.git'
test ! -f .env || (echo 'ERROR: .env present' && exit 1)
```

## Versioning

- Tag CE releases as `ce-vX.Y.Z`
- Record private source commit SHA in the CE PR description (optional: `SYNC-SOURCE.txt`)
