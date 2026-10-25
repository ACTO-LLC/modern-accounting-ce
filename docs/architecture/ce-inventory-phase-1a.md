# CE inventory — Developer Phase 1a

**Date:** 2026-10-24 (America/Los_Angeles)  
**Branch / PR:** `feat/ce-phase-1a-build-flag-fail-paid` / [#724](https://github.com/ACTO-LLC/modern-accounting/pull/724)  
**Policy:** [ce-seams.md](./ce-seams.md) · [ADR-0001](./adr-0001-open-core-community-edition.md) · [CE vs paid matrix](../prd/ce-vs-paid-feature-matrix.md)  
**Scope:** Inventory map + `CE_BUILD` scaffolding + fail-if-paid for **Stripe + RCM only**. No Phase 1b strip/export.

---

## What landed in Phase 1a

| Deliverable | Location |
|-------------|----------|
| `CE_BUILD` flag + Stripe env fail-if-paid-linked | `chat-api/src/ce/ce-build.js` (`isCeBuild`, `assertPaidNotLinked`) |
| Boot hook (after dotenv) | `chat-api/src/ce/preload.js` via `package.json` `start`/`dev` `--import` **and** `chat-api/Dockerfile` `CMD` |
| Route guards (403) | `rejectPaidCapability` + `rejectPaidPathIfCe` wired in `requireAuth` for `/api/stripe/*`, `/api/adjudication*`, `/api/rcm/*`, `/api/settlement*`, **`/api/invoices/by-claim*`** |
| Tests | `chat-api/tests/ce-build.test.js` |
| Env docs | `.env.example` (`CE_BUILD` note) |

**Not in 1a:** omit/stub of paid modules, Compose export to `modern-accounting-ce`, Books Match / ZTB / SSO / multi-co / write-agent strip.

---

## Inventory vs `ce-seams.md` (main @ c113e052)

### Stripe / Pay on Invoice — **pending merge (not on main)**

| Seams denylist | On main today? | Actual / expected paths |
|----------------|----------------|-------------------------|
| `STRIPE_*` / Stripe SDK / webhooks | **No** runtime on main | Open PR [#699](https://github.com/ACTO-LLC/modern-accounting/pull/699) (`feat/688-payments-settings-stripe`): `chat-api/src/routes/payments.js`, `chat-api/src/services/payment-settings-service.js`, `payments-provider.js`, `app.use('/api', paymentsRouter)`, client Online Payments UI, `stripe` npm dep |
| Env secrets | Documented on #699 only | `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, `PAYMENTS_ENCRYPTION_KEY`, `STRIPE_MODE` |

**Phase 1a guard:** `assertPaidNotLinked()` fails boot if `CE_BUILD` + any of those Stripe/payments env keys are non-empty. Path guard covers `/api/stripe/*` so it applies as soon as #699 merges. Prefer also mounting `rejectPaidCapability('stripe')` on the payments router when that PR lands.

### RCM / Practice OS join (#702) — **on main**

| Seams denylist | On main today? | Actual paths |
|----------------|----------------|--------------|
| `adjudication-*.js` | **Yes** | `chat-api/adjudication-inbound-facade.js`, `adjudication-payload-mapper.js`, `adjudication-posting-service.js` |
| `settlement-posting-service.js` | **Yes** | `chat-api/settlement-posting-service.js` |
| Local routes (DAB excluded) | **Yes** | `POST /api/adjudication`, `POST /api/rcm/adjudication`, `POST /api/settlement` (see `DAB_EXCLUDED_PATHS` in `chat-api/server.js`) |
| Invoice status by ClaimId (#704) | **Not on main** | Open PR [#712](https://github.com/ACTO-LLC/modern-accounting/pull/712): **primary** `GET /api/invoices/by-claim/:claimId` (guarded explicitly — **not** under `/api/rcm`); alias `GET /api/rcm/invoice-status/:claimId` (covered by `/api/rcm` prefix when merged) |
| Shared fixture (#705) | **Yes** (docs/fixture) | `docs/rcm/shared-rcm-fixture.json` (+ seed script if present) |

**Phase 1a guard:** route 403 under `CE_BUILD` (no dedicated RCM paid-link env on main). Modules are **not** deleted (scaffolding only).

### Other paid packages — inventory pointers only (no strip in 1a)

| Seams item | Paths found / expected on main | 1a action |
|------------|--------------------------------|-----------|
| ZTB / prod Plaid | `chat-api/plaid-service.js`, `plaid-sync.js`, `plaid-scheduler.js`; `/api/plaid/*` | Inventory only |
| Live QBO OAuth | `chat-api/qbo-auth.js`; `/api/qbo/*` | Inventory only |
| Write-agent | `monitor-agent/` (repo root denylist) | Inventory only |
| Books Match / Switch | Client + API modules per matrix (not stripped) | Inventory only — exact client paths = 1b |
| Multi-company | `chat-api/src/middleware/tenant.js` + client switcher | Inventory only |
| Entra / B2C SSO packaging | `.env.example` Azure AD / B2C block; `src/middleware/auth.js` | Inventory only |
| Hosted / control plane | `infra/`, `functions/` (denylist dirs) | Inventory only |

---

## Wiring note (server.js)

`chat-api/server.js` is very large; Phase 1a avoids a full-file rewrite. Boot fail-if-paid runs via `node --import ./src/ce/preload.js` in both `package.json` scripts **and** `chat-api/Dockerfile` `CMD` (Compose must use that image entrypoint). Route fails run in `requireAuth` (mounted ahead of every route). Phase 1b may inline or omit modules instead.

---

## Verify (local)

```bash
cd chat-api && npx vitest run tests/ce-build.test.js
# Boot should throw when:
#   CE_BUILD=true STRIPE_SECRET_KEY=sk_test_x npm start
# Docker/Compose must use Dockerfile CMD (or `npm start`) so preload runs.
```

Architect review requested on the PR. Full strip + `modern-accounting-ce` export remain Phase 1b / DevOps.
