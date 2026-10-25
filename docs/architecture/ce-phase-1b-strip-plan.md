# CE Phase 1b — chat-api + client strip plan (Architect)

**Status:** Plan only (docs). **Developer Phase 1b implement = HOLD** until PM greenlights separately.  
**Date:** 2026-10-25 (America/Los_Angeles)  
**Author:** MA Architect  
**Private SHA baseline:** `d97cc85` (`main` — Phase 1a CE_BUILD landed)  
**CE SHA baseline:** `7e4c29c` (Slice B merged — database/email-api/csv/dab/db-init exported; **chat-api/client still OMITTED**)  
**Policy:** [ce-seams.md](./ce-seams.md) · [ce-inventory-phase-1a.md](./ce-inventory-phase-1a.md) · [ADR-0001](./adr-0001-open-core-community-edition.md) · [CE vs paid matrix](../prd/ce-vs-paid-feature-matrix.md)  
**Public CE:** `ACTO-LLC/modern-accounting-ce`  
**Assert:** CE `scripts/assert-ce-paid-leak.sh` (not yet on private; DevOps may mirror when chat-api/client export)

This document is the **Developer Phase 1b handoff**: exact allow/deny + stub contracts so a future export of `chat-api/` + `client/` into CE passes `assert-ce-paid-leak` / `CE_BUILD` fail-if-paid. **Architect owns this plan only — no strip/stub code in this slice.**

---

## Goals

1. Promote Phase 1a denylist bullets into **file/route-level** contracts grounded in private `main` @ `d97cc85`.
2. Prefer **compile/export omit** over UI hide. Shared leftovers → CE no-op facade with **no** paid SDKs/secrets.
3. Align Dev verify with CE `assert-ce-paid-leak.sh` + private `CE_BUILD` / `assertPaidNotLinked` / `PAID_PATH_PREFIXES`.
4. Keep core ledger CE surfaces (AR receive-payment, AP bill-pay, CSV bank import, Milton BYO LLM) **in**.

---

## Stub style (non-negotiable)

| Preference | Rule |
|------------|------|
| **1st** | **Omit** paid modules from the CE export tree (do not copy the file). |
| **2nd** | If a shared module must remain for compile, ship a **CE no-op facade** that throws/`403` `"Not available in Community Edition"` and imports **no** Stripe/Plaid/Octokit/Graph paid SDKs. |
| **Never** | UI-only hide / feature-flag hide of paid packages that still ship dead webhook handlers, SDKs, or secrets. |
| **Env** | `.env.ce.example` must not assign `STRIPE_*`, prod `PLAID_*`, `GITHUB_TOKEN`, RCM secrets. |
| **Compose** | CE Compose must not define `monitor-agent` or `qbo-mcp` services (assert already fails on those). |

---

## chat-api — path inventory (private `main` @ d97cc85)

### OMIT from CE export (paid / write-agent / RCM join)

| Path | Capability | Notes |
|------|------------|-------|
| `chat-api/plaid-service.js` | ZTB / prod Plaid | npm `plaid` dep — omit package too |
| `chat-api/plaid-sync.js` | ZTB / prod Plaid | |
| `chat-api/plaid-scheduler.js` | ZTB / prod Plaid | Auto-starts when `PLAID_AUTO_SYNC !== 'false'` |
| `chat-api/qbo-auth.js` | Live QBO OAuth | Live sync paid; one-shot QBO still **Owner/PO open** |
| `chat-api/adjudication-inbound-facade.js` | Practice OS / RCM #702 | |
| `chat-api/adjudication-payload-mapper.js` | RCM | |
| `chat-api/adjudication-posting-service.js` | RCM | |
| `chat-api/settlement-posting-service.js` | RCM settlement | |
| `chat-api/src/routes/github.js` | Write-agent adjacent | Opens branches/PRs via Octokit |
| `chat-api/src/services/github.js` | Write-agent adjacent | Uses `GITHUB_TOKEN` |
| `chat-api/src/routes/deployments.js` | Hosted / control plane | Enhancement deploy scheduler |
| `chat-api/src/services/graph-api.js` | Entra/B2C SSO packaging | Graph user/group admin |
| `chat-api/tests/plaid-*.js` | Paid tests | Omit with modules |
| `chat-api/tests/adjudication-*.js` | Paid tests | |
| `chat-api/tests/settlement-posting-service.test.js` | Paid tests | |
| `chat-api/scripts/refresh-qbo-token.js` | Live QBO | |

**Not on main yet — omit when merged (do not invent paths before merge):**

| Expected path (from open PRs / inventory) | PR | Capability |
|-------------------------------------------|-----|------------|
| `chat-api/src/routes/payments.js` (Stripe Online Payments — **not** AR `/api/payments`) | [#699](https://github.com/ACTO-LLC/modern-accounting/pull/699) | Pay on Invoice |
| `chat-api/src/services/payment-settings-service.js`, `payments-provider.js` | #699 | Stripe |
| Client Online Payments settings UI from #699 | #699 | Stripe |
| `GET /api/invoices/by-claim/:claimId` (+ `/api/rcm/invoice-status/:claimId`) | [#712](https://github.com/ACTO-LLC/modern-accounting/pull/712) | RCM ClaimId |
| Books Match / Switch cutover modules | *none on main* | **Dev 1b must enumerate under policy “Books Match = paid”** when/if they land |

### KEEP in CE (core / CE-safe) — do **not** strip

| Path / surface | Why CE-OK |
|----------------|-----------|
| `chat-api/server.js` (stripped of paid mounts — see below) | API host |
| `chat-api/src/ce/*` (`ce-build.js`, `preload.js`) | CE_BUILD + fail-if-paid |
| `chat-api/tests/ce-build.test.js` | Guard tests |
| `chat-api/journal-entry-*.js`, `src/db/*`, `src/routes/tax.js`, `src/routes/users.js` (CE-safe subset) | Core ledger / local users |
| `chat-api/src/middleware/requireAuth.js` + `auth.js` with **`BYPASS_AUTH=true` path** | Local/simple auth |
| `chat-api/src/services/contact-extractor.js`, `web-renderer.js`, `tax-calculation.js`, `audit-log.js` | Core |
| `chat-api/mcp-client.js` + Milton chat routes | Milton RO BYO LLM |
| `chat-api/migration/*` | QBO **one-shot** migration helpers — **KEEP only if PO locks one-shot in CE**; else stub/omit with live QBO. Default this plan: **HOLD with live QBO** (omit `qbo-auth.js` forces migration paths to stub). |
| AR `POST /api/payments`, AP `POST /api/billpayments` (DAB-excluded core posting) | **Core ledger** — not Stripe |

### server.js surgery contract (Dev 1b)

When exporting `chat-api/server.js`, Dev must:

1. **Remove imports** of omitted modules (`plaid-*`, `qbo-auth`, `adjudication-*`, `settlement-*`, `githubRoutes`, `deploymentsRouter` if control-plane).
2. **Omit route blocks** (or replace with `rejectPaidCapability` 403 stubs that import only `src/ce/ce-build.js`):

| Route prefix / mount | Capability | CE action |
|----------------------|------------|-----------|
| `/api/plaid/*` (all link-token, sync, scheduler, verify-bank) | ZTB / Plaid | **Omit** |
| `/api/qbo/connect`, `/oauth-callback`, `/callback`, `/status`, `/disconnect`, `/analyze`, live sync helpers | Live QBO | **Omit** |
| `/api/qbo/export`, `/api/qbo/export/entities`, migrate_* tool handlers that call `qboAuth` | Live/one-shot QBO | **Omit** until PO locks one-shot |
| `/api/adjudication`, `/api/rcm/adjudication`, `/api/settlement` | RCM | **Omit** (Phase 1a already 403 under `CE_BUILD`) |
| `/api/github/*` | Write-agent | **Omit** |
| `/api/enhancements/*` | Monitor-agent admin API | **Omit** |
| `/api/deployments/*` | Control plane | **Omit** |
| `/api/stripe/*` (when #699 merges) | Stripe | **Omit** + keep `PAID_PATH_PREFIXES` |
| `/api/invoices/by-claim*` (when #712 merges) | RCM | **Omit** + keep prefix |

3. **Do not start** `plaidScheduler` on listen.
4. Keep `CE_BUILD` preload (`node --import ./src/ce/preload.js`) in `package.json` + Dockerfile `CMD`.
5. Expand `assertPaidNotLinked` / env denylist if new paid env keys appear (see Env section).

### package.json deps — omit from CE chat-api

| Dep | Reason |
|-----|--------|
| `plaid` | Paid ZTB |
| `@octokit/rest` (if only used by github service) | Write-agent |
| `stripe` (when #699 merges) | Pay on Invoice |

`@azure/msal-node` / `@azure/identity`: CE default is `BYPASS_AUTH`. Prefer omit Graph-only usage; if auth.js still references jose JWKS for Entra, **stub auth to BYPASS-only** in CE rather than shipping full SSO packaging (matrix: Entra/B2C = paid).

### middleware/tenant.js

| Item | CE contract |
|------|-------------|
| `chat-api/src/middleware/tenant.js` | Multi-company / tenancy hardening = **paid**. CE = single-company. **Stub** to a fixed single-tenant resolver (or no-op that ignores `X-Tenant-Id` multi-tenant switching) **without** querying `Tenants.EntraIdTenantId` / subscription tiers as a product surface. |
| `POST/PATCH /api/companies` multi-tenant create | Single-company only — Dev must ensure CE cannot create/switch tenants as a product feature. |

---

## client — path inventory (private `main` @ d97cc85)

### OMIT from CE export

| Path | Capability |
|------|------------|
| `client/src/components/PlaidBankVerification.tsx` | ZTB / Plaid |
| `client/src/components/PlaidLinkButton.tsx` | ZTB / Plaid |
| `client/src/pages/PlaidConnections.tsx` | ZTB / Plaid |
| `client/src/components/QBOConnectButton.tsx` | Live QBO |
| `client/src/pages/AdminEnhancements.tsx` | Monitor-agent admin UI |
| `client/src/components/admin/*` (Enhancement*, DeploymentScheduler) | Monitor-agent / control plane |
| `client/src/services/enhancementApi.ts` (+ test) | Monitor-agent |
| `client/src/pages/Cases.tsx`, `Attorneys.tsx`, `EditCase.tsx`, `EditAttorney.tsx` | Medical RCM UI (`medical_rcm`) |
| `client/src/pages/reports/ARAgingByPayer.tsx` | Medical RCM |
| `client/src/pages/reports/PatientStatements.tsx` | Medical RCM |
| `client/src/pages/reports/CaseARAging.tsx` | Medical RCM |
| `client/tests/plaid-*.spec.ts`, `admin-enhancement-e2e.spec.ts` | Paid tests |

**Nav / routes:** remove from `navConfig.ts` + `App.tsx`:

- `/plaid-connections`
- `/admin/enhancements` (+ admin enhancement components)
- Medical RCM group (`visibilityFlag: 'medical_rcm'`) — pages/routes above
- Any future Online Payments / Stripe settings routes from #699
- Live QBO connect entry points (`QBOConnectButton` in `ChatInterface.tsx` — replace with omit or CE docs link)

### KEEP in CE (core ledger — do **not** confuse with Stripe)

| Path | Why CE-OK |
|------|-----------|
| `client/src/pages/Payments.tsx`, `NewPayment.tsx`, `EditPayment.tsx` | **AR receive payment** (core) |
| `client/src/components/ReceivePaymentForm.tsx` | Core AR |
| `client/src/pages/BillPayments.tsx`, `NewBillPayment.tsx`, `PayBillForm` | **AP bill pay** (core) |
| `client/src/pages/BankImport*.tsx`, `Banking.tsx`, `BankTransactions.tsx`, CSV import flows | CSV bank import = CE |
| `client/src/pages/CompanySettings.tsx` | Single-company settings (strip SSO/Stripe subsections if present) |
| Milton / `ChatInterface.tsx` | BYO LLM — strip QBO connect button |

### Stub / simplify (shared leftovers)

| Path | CE behavior |
|------|-------------|
| `client/src/contexts/TenantContext.tsx` | **Single-tenant facade** (BypassTenantProvider-style only). No multi-company switcher UI. |
| `client/src/contexts/AuthContext.tsx` | CE ships **`VITE_BYPASS_AUTH=true`** path only. Prefer omit `@azure/msal-browser` / `@azure/msal-react` from CE `package.json` and keep Bypass provider. |
| `client/src/contexts/FeatureFlagsContext.tsx` | Drop `medical_rcm` from CE FeatureKey **or** hard-disable; do not ship RCM pages gated “off” while still in the bundle if omit is feasible. |
| `client/src/components/navigation/navConfig.ts` | Remove paid nav entries (Plaid, admin enhancements, medical_rcm group). |

### package.json deps — omit from CE client

| Dep | Reason |
|-----|--------|
| `react-plaid-link` | Plaid |
| `@azure/msal-browser`, `@azure/msal-react` | Entra/B2C SSO packaging (CE = bypass) |
| `stripe` / `@stripe/*` (when #699 merges) | Pay on Invoice |

### Dev 1b must enumerate (policy locked; paths may grow)

Do **not** guess missing filenames. Under these policies, Dev 1b greps private tree at export time and adds hits to the omit list:

| Policy | Grep / heuristic |
|--------|------------------|
| Books Match / Switch cutover | `books.?match`, `switch.?cutover`, Switch cutover modules |
| Stripe Online Payments | `stripe`, `STRIPE_`, Online Payments settings (after #699) |
| Zero-Touch Banking depth beyond Plaid files above | `zero-touch`, confidence-approve / weekly-brief UI |
| Multi-company switcher UI | company switcher components referencing `TenantContext` / `maxCompanies` |
| SSO admin | Entra/B2C admin screens beyond bypass Login |
| RCM ClaimId UI | `ClaimId`, invoice-by-claim screens (after #712) |

---

## Capability → CE contract (summary)

| Paid capability | CE behavior | Primary omit targets |
|-----------------|-------------|----------------------|
| Pay on Invoice (Stripe) | **Omit** packages; no dead webhooks; docs link to Paid/hosted | #699 paths when merged; `STRIPE_*` env; `PAID_PATH_PREFIXES` `/api/stripe` |
| Books Match / Switch | **Omit** | *Dev enumerate* — none on main @ d97cc85 |
| Zero-Touch Banking / prod Plaid | **Omit** Plaid jobs/UI; **keep** CSV bank import | `plaid-*`, Plaid client pages/components, `plaid` npm |
| Live QBO sync | **Omit** | `qbo-auth.js`, `/api/qbo/*` live routes, `QBOConnectButton` |
| One-shot QBO import/export | **Owner/PO open** — default omit with live QBO until locked | migration tool handlers depending on `qboAuth` |
| Write monitor-agent | **Omit** entire `monitor-agent/` (already CE denylist) + chat-api github/enhancements/deployments + client admin enhancements | see tables |
| Entra / B2C SSO + MFA | **Local / `BYPASS_AUTH` only** | Stub AuthContext; omit MSAL deps; stub/omit `graph-api.js` |
| Multi-company | Single-company only | Stub `tenant.js` + `TenantContext` |
| Practice OS / RCM join (#702) | **Omit** adapters + medical_rcm UI | adjudication/settlement modules; Cases/Attorneys/PatientStatements/ARAgingByPayer; ClaimId routes when #712 merges |
| Managed cloud UI (#630) | Scripts-only docs | omit `deployments` router / DeploymentScheduler |

---

## CE_BUILD / assert-ce-paid-leak — what must be true after export

### Private scaffolding already landed (Phase 1a #724)

| Helper | Location | Phase 1b expectation |
|--------|----------|----------------------|
| `isCeBuild` / `assertPaidNotLinked` | `chat-api/src/ce/ce-build.js` | Boot fails if `CE_BUILD` + any `STRIPE_PAID_ENV_KEYS` set |
| `PAID_PATH_PREFIXES` | same | Keep `/api/stripe`, `/api/adjudication`, `/api/rcm`, `/api/settlement`, `/api/invoices/by-claim`; **add** `/api/plaid`, `/api/github`, `/api/enhancements`, `/api/deployments`, and live `/api/qbo` (or omit routes entirely so prefixes are belt-and-suspenders) |
| `rejectPaidPathIfCe` in `requireAuth` | Phase 1a | Retain for any residual mounts |
| Preload | `package.json` + Dockerfile `CMD` | Must run in CE image |

### CE tree assert (`modern-accounting-ce/scripts/assert-ce-paid-leak.sh`)

After chat-api/client export, `./scripts/assert-ce-paid-leak.sh` must exit 0. That means **no hits** outside allowed docs/SYNC/README/NOTICE/LICENSE/assert script itself for:

`stripe|STRIPE_|books[- ]?match|zero-touch|write-agent|multi-company|sk_live|sk_test|whsec_|\bClaimId\b|\bRCM\b|Fluent[- ]?MedOps|monitor[- ]?agent|\bEntra\b|\bB2C\b`

and:

`plaid-service|plaid-sync|GITHUB_TOKEN|monitor-agent`

Plus: no `.env` / `.env.ce` present; `.env.ce.example` must not assign `STRIPE_|PLAID_|GITHUB_TOKEN=`; `docker-compose.ce.yml` must not define `monitor-agent` or `qbo-mcp` services; `database/` scanned for secret/SDK markers only.

**Implication for Dev:** omitted files must be **gone** from the CE tree (not merely unreferenced). Comments/strings inside kept files that trip `rg` must be scrubbed or reworded. Schema leftovers in `database/` stay documented in SYNC.md (Slice B stance) — do not redesign schema in 1b.

### Recommended Dev verify checklist (single list)

```bash
# In CE worktree after chat-api/client export
./scripts/assert-ce-paid-leak.sh

# In stripped chat-api
CE_BUILD=true npm start   # must boot
CE_BUILD=true STRIPE_SECRET_KEY=sk_test_x npm start  # must throw (assertPaidNotLinked)
npx vitest run tests/ce-build.test.js

# Spot-check omitted paths absent
test ! -f chat-api/plaid-service.js
test ! -f chat-api/qbo-auth.js
test ! -f chat-api/adjudication-posting-service.js
test ! -f client/src/pages/PlaidConnections.tsx
test ! -d monitor-agent

# Compose
rg -n '^\s*(monitor-agent|qbo-mcp)\s*:' docker-compose.ce.yml  # expect no matches
```

---

## Env denylist (CE `.env.ce.example` / runtime)

Never ship assignments for:

| Vars | Capability |
|------|------------|
| `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, `PAYMENTS_ENCRYPTION_KEY`, `STRIPE_MODE` | Stripe |
| `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV=production` (any prod Plaid packaging) | ZTB |
| `GITHUB_TOKEN`, `GITHUB_OWNER`, `GITHUB_REPO` (write) | Write-agent |
| RCM / Fluent MedOps join secrets (when introduced) | RCM |
| Graph/SSO admin secrets required only for Entra packaging | SSO |

CE OK placeholders: SQL, SMTP, BYO LLM, `CE_BUILD=true`, `BYPASS_AUTH=true`, `VITE_BYPASS_AUTH=true`.

---

## Developer Phase 1b handoff checklist (**HOLD** — PM greenlight separate)

- [ ] PM/Owner greenlights **Dev 1b implement** (this Architect plan does **not** authorize code strip).
- [ ] Re-baseline private `main` SHA; re-run path inventory greps (tables above + “must enumerate” policies).
- [ ] Strip/omit chat-api paid modules + surgery on `server.js` per contract.
- [ ] Strip/omit client paid pages/components/nav; stub Tenant/Auth to single-company + bypass.
- [ ] Drop paid npm deps from CE package.json files; ensure lockfile has no Stripe/Plaid/Octokit write leftovers that assert flags.
- [ ] Extend `PAID_PATH_PREFIXES` / `assertPaidNotLinked` for plaid/github/qbo/enhancements as belt-and-suspenders **or** prove routes fully omitted.
- [ ] Wire CE `docker-compose.ce.yml` services for stripped `chat-api` + `client` (DevOps may share).
- [ ] Run assert + CE_BUILD verify checklist; open CE export PR → **Architect review** → merge.
- [ ] Do **not** continuous-mirror; manual one-shot only (SYNC.md).

**Out of Dev 1b:** schema redesign; exporting `monitor-agent/` or `infra/`; implementing Stripe/Books Match; changing ADR-0001.

---

## Open decisions (PO / Owner)

| Item | Default in this plan | Needs lock? |
|------|----------------------|-------------|
| One-shot QBO import/export in CE Phase 1b | **Defer/omit** with live QBO | Yes — if PO wants one-shot in first chat-api export |
| `ma-mcp-server/` in CE | **Defer** (Architect review later) | Yes before export |
| Expand `assertPaidNotLinked` to PLAID_/GITHUB_TOKEN | Recommended yes | Dev/Architect align at implement |
| Mirror `assert-ce-paid-leak.sh` into private `scripts/` | Optional | DevOps |
| Stripe #699 / ClaimId #712 land before Dev 1b? | Plan already lists expected omit paths | Re-inventory at implement |

---

## Success criteria (this Architect slice)

- [x] This file on private `docs/architecture/ce-phase-1b-strip-plan.md`
- [ ] `ce-seams.md` links here; vague denylist bullets point at concrete inventory
- [ ] CE `SYNC.md` + mirrored seams updated for Phase 1b plan readers
- [ ] **No** strip/stub runtime code; **no** chat-api/client export in this slice
- [ ] Dev 1b remains **HOLD**

