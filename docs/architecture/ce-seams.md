# CE package seams (Phase 1a)

**Status:** Draft for Phase 1b export  
**Date:** 2026-10-24 (America/Los_Angeles)  
**Author:** MA Architect  
**Policy:** [ADR-0001](./adr-0001-open-core-community-edition.md) (Accepted) + [CE vs paid matrix](../prd/ce-vs-paid-feature-matrix.md)  
**Public CE:** `ACTO-LLC/modern-accounting-ce`  
**Private product:** `ACTO-LLC/modern-accounting`

This document is the **source of truth** for what Phase 1b+ may copy into the public CE repo. It does **not** copy runtime code by itself (Phase 1a = seams only).

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

When exporting `chat-api/`, **omit or stub** at least:

| File / pattern | Reason |
|----------------|--------|
| `chat-api/plaid-service.js`, `plaid-sync.js`, `plaid-scheduler.js` | ZTB / prod Plaid packaging — paid |
| `chat-api/qbo-auth.js` | Live QBO OAuth — paid |
| `chat-api/adjudication-*.js`, `settlement-posting-service.js` | Treat as **RCM / #702-class** until Dev proves CE-safe — default **omit** |
| Any `STRIPE_*` / Stripe SDK / webhook handlers | Pay on Invoice — paid |
| Books Match / Switch cutover modules | Paid |
| Multi-company / tenancy enforcement modules | Paid |
| Entra / B2C SSO packaging | Paid |

When exporting `client/src/`, **omit or stub** routes/components for: payments/Stripe settings, Books Match, Zero-Touch Banking depth, live QBO connect, SSO admin, multi-company switcher, RCM/Practice OS join, monitor-agent admin.

Exact client path list = **Developer Phase 1b** task using this policy (HOLD until separate greenlight).

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

```bash
# From CE worktree — expect no paid markers or secrets
rg -i 'stripe|STRIPE_|books.?match|zero-touch|write-agent|multi-company|sk_live|sk_test|whsec_|ClaimId|RCM|Fluent.?MedOps|monitor.?agent|Entra|B2C' --glob '!.git'
# Plaid prod / agent write
rg -i 'plaid-service|plaid-sync|GITHUB_TOKEN|monitor-agent' --glob '!.git'
test ! -f .env || (echo 'ERROR: .env present' && exit 1)
```

Architect reviews every CE export **PR** (no direct-to-main for runtime trees).

---

## Success criteria (this Phase 1a slice)

- [x] This file on private `docs/architecture/ce-seams.md`
- [ ] CE repo PR updates `SYNC.md` to point at seams + path tables
- [ ] No Developer strip code and no DevOps full export in this slice

## Deferred

- Full runtime tree export (Phase 1b — separate ≤$3 / Owner over-cap)
- Continuous mirror CI
- Client/API file-by-file strip implementation (Developer)
- Public launch security bar (#667-class)

