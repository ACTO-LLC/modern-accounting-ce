# Syncing private → Community Edition (manual one-shot)

**Private source:** `ACTO-LLC/modern-accounting`  
**Public CE:** `ACTO-LLC/modern-accounting-ce`  
**Cadence:** Manual. **No automated mirror CI** yet.  
**Policy:** [ADR-0001](./docs/architecture/adr-0001-open-core-community-edition.md) (Accepted) + [CE vs paid matrix](./docs/prd/ce-vs-paid-feature-matrix.md)  
**Seams (Phase 1a):** [docs/architecture/ce-seams.md](./docs/architecture/ce-seams.md) (mirrored from private) — path allow/deny, stub contracts, Compose target.  
**Phase 1b strip plan:** [docs/architecture/ce-phase-1b-strip-plan.md](./docs/architecture/ce-phase-1b-strip-plan.md) — chat-api + client omit contracts (Dev 1b scaffolding on private; **CE export in this tree**).

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

Concrete chat-api/client file lists + route prefixes: [ce-phase-1b-strip-plan.md](./docs/architecture/ce-phase-1b-strip-plan.md). Core AR receive-payment / AP bill-pay stay in CE; Stripe Online Payments / Plaid / live QBO / RCM join / write-agent admin do not.

## Compose target (chat-api/client export)

**In (exported):** database, db-init, dab, email-api, csv-import-api, **chat-api** (stripped), **client** (stripped) under Compose profile `app`.  
**Out:** monitor-agent, live QBO MCP / `qbo-mcp` (unless one-shot approved), managed cloud control plane, `ma-mcp` (deferred until Architect review).

See `docker-compose.ce.yml` + `docs/self-host/ce-boot.md`. Private source SHA: `SYNC-SOURCE.txt` (currently `38e9333c` — post Dev 1b #726).

### Phase 1b export note (2026-10-25)

Dev 1b strip/stub scaffolding landed on private `main` @ `38e9333c` (#726). This CE tree exports stripped `chat-api/` + `client/` (omit-manifest + CE bridges/facades + `CE_BUILD` / `VITE_CE_BUILD`). One-shot QBO migrate tooling and live QBO auth remain **omitted**. Before merge: `./scripts/assert-ce-paid-leak.sh` + strip-plan `CE_BUILD` checks must pass; Architect boundary review required.

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

## Known schema leftovers (document, not redesign)

Export keeps core `database/` DDL. Assert skips most of `database/` for paid-pattern noise. Known leftovers that are **not** a Slice B redesign:

| Leftover | Where | CE stance |
|----------|--------|-----------|
| RCM-shaped credit memo types / `PayerId` / party checks | `CreditMemos` (+ related) | Columns/constraints stay; paid RCM routes/adapters stay omitted |
| `PrimaryPayerId` on invoices | `Invoices` / `v_Invoices` | Id only; DAB does not map missing `PrimaryPayerName` |
| Plaid column stubs | `Employees` (`PlaidItemId`, `PlaidAccountId`), `BankTransactions` (`PlaidTransactionId`, `PlaidAccountId`) | No Plaid services/secrets in CE; columns inert |
| Entra/B2C Users shape | `Users` | Use `BYPASS_AUTH`; see `docs/self-host/ce-boot.md` |
| `QBOConnections` table | `database/` | DAB entity omitted; no token exposure via CE DAB |

Do **not** regenerate or commit `database/deploy-script.sql` — `scripts/deploy-db.js` may write one under an output dir at runtime (`--script-only`); that artifact is gitignored / not part of the CE tree.
