# Syncing private → Community Edition (manual one-shot)

**Private source:** `ACTO-LLC/modern-accounting`  
**Public CE:** `ACTO-LLC/modern-accounting-ce`  
**Cadence:** Manual. **No automated mirror CI** in Phase 0.  
**Policy:** [ADR-0001](./docs/architecture/adr-0001-open-core-community-edition.md) (Accepted) + [CE vs paid matrix](./docs/prd/ce-vs-paid-feature-matrix.md)

## When to sync

- After CE-safe fixes land on private `main`
- Before a tagged CE release (`ce-vX.Y.Z`)
- When Architect/DevOps opens a Phase N export ticket

## One-shot procedure

1. Check out a clean private `main` (or release tag). Record the private commit SHA.
2. Copy **only** the CE allowlist (below) into a clean worktree of `modern-accounting-ce` — do **not** mirror the full monorepo.
3. Refresh root `LICENSE` (AGPL-3.0), `NOTICE`, and this `SYNC.md` if the strip list changed.
4. Keep CE `README.md` CE-only (no paid entitlements presented as included).
5. Scrub secrets before PR (see Verify).
6. Open a PR on `modern-accounting-ce` → Architect review → merge.

## Sync **in** (CE — AGPL)

| Area | Notes |
|------|--------|
| Core ledger | COA, journals, invoices / bills / estimates, AR/AP, standard reports |
| Single-company | Only; no multi-co tenancy |
| Docker Compose one-box | Local / self-host stubs in this repo |
| Local / simple auth | `BYPASS_AUTH` / documented local accounts — not Entra/B2C |
| CSV bank import | CE |
| Basic SMTP invoice email | CE |
| Milton read-only Q&A | **BYO** LLM API key only |
| One-shot QBO import/export | Optional CE; **not** live QBO sync |
| Docs | Self-host, ADR-0001, CE vs paid matrix, #630 **scripts-only** pause/unpause notes |
| CE `.env.example` | Placeholders only — no real secrets |

## Stay **private** (paid / commercial — never sync)

| Area | Notes |
|------|--------|
| Pay on Invoice / Stripe | Checkout, webhooks, settings, `STRIPE_*` |
| Switch / Books Match | Cutover / confidence product |
| Zero-Touch Banking | Confidence approve, weekly brief, **prod** Plaid packaging |
| Live QBO sync | Production QuickBooks Online paths |
| Write-agent / monitor-agent writes | Code-writing agent, PR-opening tooling |
| Entra ID / B2C SSO, MFA packaging | Enterprise SSO |
| Multi-company / tenancy hardening | Paid |
| Practice OS / medical RCM join | Fluent MedOps ↔ MA, ClaimId / #702-class |
| Managed cloud start/pause UI + SLA | #630 **productized** UI — CE gets scripts-only |
| Support SLA / ACTO control plane | Hosted |

## Architecture rules (from ADR)

1. One schema family — no permanent CE DB fork.
2. CE builds **strip or stub** paid packages — not UI-only hides.
3. No Stripe secrets, payment webhooks, agent GitHub write paths, or RCM join adapters as dead code in CE.
4. No automated private→public mirror CI in Phase 0.

## Verify before merge

```bash
# From CE worktree — expect no paid markers or secrets
rg -i 'stripe|STRIPE_|books.?match|zero-touch|write-agent|multi-company|sk_live|sk_test|whsec_|ClaimId|rcm.?join' --glob '!.git'
# Never commit real .env
test ! -f .env || (echo 'ERROR: .env present' && exit 1)
```

## Versioning

- Tag CE releases as `ce-vX.Y.Z`
- Record private source commit SHA in the CE PR description (optional: `SYNC-SOURCE.txt`)
