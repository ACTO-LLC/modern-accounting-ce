# CE package seams (Phase 1a + 1b plan)

**Status:** Phase 1a seams landed; **Phase 1b strip plan** documented — Dev implement **HOLD**  
**Date:** 2026-10-25 (America/Los_Angeles) (1a: 2026-10-24)  
**Author:** MA Architect  
**Policy:** [ADR-0001](./adr-0001-open-core-community-edition.md) (Accepted) + [CE vs paid matrix](../prd/ce-vs-paid-feature-matrix.md)  
**Phase 1b strip plan:** [ce-phase-1b-strip-plan.md](./ce-phase-1b-strip-plan.md) (chat-api + client file/route contracts)  
**Phase 1a inventory:** [ce-inventory-phase-1a.md](./ce-inventory-phase-1a.md)  
**Public CE:** `ACTO-LLC/modern-accounting-ce`  
**Private product:** `ACTO-LLC/modern-accounting`

This document is the **source of truth** for what may copy into the public CE repo. Phase 1a = seams only. Phase 1b Architect = strip **plan** only (no runtime export of chat-api/client until Dev 1b is greenlit).

---

## Goals

1. One schema family — no permanent CE database fork.
2. CE builds **strip or stub** paid packages — not UI-only hides.
3. No dead Stripe / payment webhooks / agent GitHub write / RCM adapters / prod Plaid in CE images.
4. Manual one-shot export only (no continuous private→CE mirror CI yet).

---

## Path allowlist (sync **into** CE)

Copy these from private `main` (or a release tag) into `modern-accounting-ce`, then strip denylisted files inside them (see below).

| Path | CE role | Notes |
|------|---------|--------|
| `database/` | Core schema + migrations | **Strip** paid-only migrations if/when identified; prefer CE-safe subset. Keep single-company. |
| `client/` | SPA | **Strip/stub** paid UI routes (payments, Books Match, ZTB depth, SSO admin, multi-co, RCM). |
| `chat-api/` | API | **Strip** paid modules (see denylist files). Milton RO BYO LLM OK. |
| `csv-import-api/` | CSV bank import | CE. |
| `email-api/` | Basic SMTP invoice email | CE; no paid control-plane. |
| `dab-config.json` (+ `dab-config.development.json` if needed) | Data API Builder | Review entities; omit paid-only entities if present. |
| `.devcontainer/` (db-init only as needed) | Local DB init | For Compose `db-init` parity. |
| `docs/architecture/adr-0001-*.md` | ADR | Already in CE. |
| `docs/prd/ce-vs-paid-feature-matrix.md` | Matrix | Already in CE. |
| `docs/self-host/` | Self-host | #630 **scripts-only**; no managed cloud UI. |
| `scripts/` (CE-safe subset) | Ops scripts | Pause/unpause scripts OK; no ACTO control plane. |
| Root CE files | License surface | `LICENSE`, `NOTICE`, `SYNC.md`, `README.md`, `docker-compose.ce.yml`, `.env.ce.example` |

### Optional CE (Owner/PO still open)

| Path / feature | Decision |
|----------------|----------|
| One-shot QBO import/export | **Defer** unless PO locks “in Phase 1b”. Live QBO stays private. |
| `qbo-mcp-http-server/` | **Defer** — live/prod QBO paths are paid; sandbox one-shot may be a later slice. |
| `ma-mcp-server/` | **Candidate** for CE if read-only against customer books; Architect review before export. |

---

## Path denylist (never sync)

| Path | Reason |
|------|--------|
| `monitor-agent/` | Write-agent / opens PRs / GitHub write — **paid**. |
| `infra/` | Hosted / control plane / cloud packaging — **paid/private**. |
| `functions/` | Review before any export; default **private** until proven CE-safe. |
| `qbo-mcp-http-server/` | Live QBO — **paid** (until optional one-shot slice). |
| Private `.env`, secrets, Key Vault values | Never. |
| Commercial license body | Private only. |

---

## File-level denylist (inside allowlisted dirs)

**Authoritative inventory:** [ce-phase-1b-strip-plan.md](./ce-phase-1b-strip-plan.md). Summary below (private `main` @ `d97cc85`).

When exporting `chat-api/`, **omit** at least:

| File / pattern | Reason |
|----------------|--------|
| `plaid-service.js`, `plaid-sync.js`, `plaid-scheduler.js` | ZTB / prod Plaid — paid |
| `qbo-auth.js` (+ `/api/qbo/*` live routes; `scripts/refresh-qbo-token.js`) | Live QBO OAuth — paid |
| `adjudication-*.js`, `settlement-posting-service.js` | RCM / #702 — **omit** |
| `src/routes/github.js`, `src/services/github.js` | Write-agent (`GITHUB_TOKEN`) — paid |
| `src/routes/deployments.js`, enhancement API mounts | Control plane / monitor-agent admin — paid |
| `src/services/graph-api.js` | Entra Graph SSO packaging — paid |
| Stripe Online Payments modules when [#699](https://github.com/ACTO-LLC/modern-accounting/pull/699) merges | Pay on Invoice — paid (**not** core AR `/api/payments`) |
| ClaimId invoice routes when [#712](https://github.com/ACTO-LLC/modern-accounting/pull/712) merges | RCM — paid |
| Books Match / Switch cutover modules | Paid — *none on main yet; Dev enumerates at export* |
| `src/middleware/tenant.js` multi-tenant product surface | Paid — stub single-company |

When exporting `client/src/`, **omit** at least: `Plaid*` pages/components, `QBOConnectButton`, `AdminEnhancements` + `components/admin/*`, medical_rcm pages (`Cases`, `Attorneys`, `PatientStatements`, `ARAgingByPayer`, `CaseARAging`), future Stripe Online Payments UI (#699). **Keep** core AR `Payments` / `ReceivePaymentForm` and AP `BillPayments` (ledger, not Stripe). Stub `TenantContext` + `AuthContext` to single-company + `VITE_BYPASS_AUTH`.

**Developer Phase 1b implement = HOLD** until PM greenlights separately. Use the strip plan checklist.

---

## Stub contracts

| Paid capability | CE behavior |
|-----------------|-------------|
| Pay on Invoice (Stripe) | **Omit** packages; no dead webhook routes; UI link to “Paid / hosted” only in docs |
| Books Match | **Omit** |
| Zero-Touch Banking / prod Plaid | **Omit** Plaid jobs; CSV bank import remains |
| Live QBO sync | **Omit**; optional one-shot later |
| Write monitor-agent | **Omit** entire `monitor-agent/` from CE Compose |
| Entra / B2C SSO + MFA | **Local / `BYPASS_AUTH`** only in CE |
| Multi-company | Single-company only; no tenancy switcher |
| Practice OS / RCM join (#702) | **Omit** adjudication/settlement join adapters |
| Managed cloud UI (#630 productized) | Scripts-only docs; no control-plane services |

**Stub style (for Dev 1b):** prefer **compile/export omit** over runtime feature-flag hide. If a shared module must remain, expose a no-op CE facade that throws “not in Community Edition” and contains **no** secrets or third-party SDKs.

---

## Compose target (Phase 1b)

Private `docker-compose.yml` today: `database`, `db-init`, `dab`, `qbo-mcp`, `ma-mcp`, `email-api`, profiles `app` (`chat-api`, `client`), profile `agent` (`monitor-agent`).

**CE `docker-compose.ce.yml` target (1b):**

| Service | In CE Compose? |
|---------|----------------|
| `database` (MSSQL) | **Yes** (already stubbed in Phase 0) |
| `db-init` | **Yes** (when database tree exported) |
| `dab` | **Yes** |
| `email-api` | **Yes** |
| `csv-import-api` | **Yes** (add service when exported; may be invoked via chat-api today — confirm in 1b) |
| `chat-api` | **Yes** (stripped) |
| `client` | **Yes** (stripped) |
| `ma-mcp` | **Maybe** — only if CE-safe read-only |
| `qbo-mcp` | **No** (unless one-shot slice approved) |
| `monitor-agent` | **No** |

Env: extend `.env.ce.example` only with CE placeholders (SMTP, BYO LLM, SQL). Never `STRIPE_*`, prod `PLAID_*`, agent `GITHUB_TOKEN` write, RCM secrets.

---

## Phase 1b verify (before CE PR merge)

Primary gate on CE worktree (after chat-api/client export):

```bash
./scripts/assert-ce-paid-leak.sh
```

Manual equivalent + CE_BUILD checks: see [ce-phase-1b-strip-plan.md](./ce-phase-1b-strip-plan.md) § CE_BUILD / assert-ce-paid-leak.

```bash
# From CE worktree — expect no paid markers or secrets (docs/SYNC/README excluded by assert script)
rg -i 'stripe|STRIPE_|books.?match|zero-touch|write-agent|multi-company|sk_live|sk_test|whsec_|ClaimId|RCM|Fluent.?MedOps|monitor.?agent|Entra|B2C' --glob '!.git'
rg -i 'plaid-service|plaid-sync|GITHUB_TOKEN|monitor-agent' --glob '!.git'
test ! -f .env || (echo 'ERROR: .env present' && exit 1)
```

Architect reviews every CE export **PR** (no direct-to-main for runtime trees).

---

## Success criteria

### Phase 1a (landed)
- [x] This file on private `docs/architecture/ce-seams.md`
- [x] CE `SYNC.md` + mirrored seams (Phase 1a)
- [x] Dev Phase 1a: `CE_BUILD` + fail-if-paid Stripe/RCM (#724)
- [x] DevOps Slice B: database/email-api/csv/dab exported (CE PR #3 @ `7e4c29c`); chat-api/client **still omitted**

### Phase 1b Architect (this slice — plan only)
- [x] [ce-phase-1b-strip-plan.md](./ce-phase-1b-strip-plan.md) with file/route contracts
- [ ] CE `SYNC.md` / seams mirror updated for Phase 1b plan
- [x] No Developer strip code; no chat-api/client export in this slice
- [x] Dev 1b remains **HOLD**

## Deferred

- chat-api/client strip + CE export (Developer Phase 1b — **HOLD**, separate PM greenlight)
- Continuous mirror CI
- Public launch security bar (#667-class)

---

## Developer Phase 1a status (2026-10-24)

**Landed (private repo):** `CE_BUILD` flag scaffolding + fail-if-paid for **Stripe + RCM only** — see [ce-inventory-phase-1a.md](./ce-inventory-phase-1a.md).

- Boot: `chat-api/src/ce/preload.js` → `assertPaidNotLinked()` (Stripe env)
- Routes: 403 via `requireAuth` / `rejectPaidCapability` on `/api/stripe/*`, `/api/adjudication*`, `/api/rcm/*`, `/api/settlement*`, `/api/invoices/by-claim*`
- **Not landed:** full omit/stub strip, chat-api/client Compose export to `modern-accounting-ce` (Dev Phase 1b + DevOps — **HOLD**)

## Architect Phase 1b status (2026-10-25)

**Landed (docs only):** [ce-phase-1b-strip-plan.md](./ce-phase-1b-strip-plan.md) — concrete chat-api/client omit lists, stub style, `assert-ce-paid-leak` / `CE_BUILD` checklist, Dev handoff. **No runtime strip in this slice.**
