# Syncing private → Community Edition (manual one-shot)

**Private source:** `ACTO-LLC/modern-accounting`  
**Public CE:** `ACTO-LLC/modern-accounting-ce`  
**Cadence:** Manual. No automated mirror CI in Phase 0.

## When to sync

- After CE-safe fixes land on private `main`
- Before a tagged CE release
- When Architect/DevOps opens a Phase N export ticket

## One-shot procedure

1. Check out a clean private `main` (or release tag).
2. Copy the CE allowlist tree into a clean worktree of `modern-accounting-ce` (or rsync with excludes below).
3. Refresh root `LICENSE` (AGPL-3.0), `NOTICE`, and this `SYNC.md` if the strip list changed.
4. Rewrite CE `README.md` so it describes CE only (no paid entitlements as if included).
5. Scrub secrets: grep for `sk_live`, `sk_test`, `whsec_`, Key Vault URIs with values, connection strings, `.env` (never commit real `.env`).
6. Open a PR on `modern-accounting-ce` → Architect review → merge.

## Must exclude (paid / private)

| Area | Notes |
|------|--------|
| Stripe / Pay on Invoice | Settings payments UI, Stripe SDK, webhooks, `STRIPE_*` |
| Books Match / Switch Guarantee | Migration confidence / cutover product |
| Zero-Touch Banking | ZTB product surfaces / prod Plaid readiness product |
| Live QBO | Production QuickBooks Online paths |
| Write-agent | Agent write tooling productized for paid |
| SSO | Enterprise SSO |
| Multi-company | Multi-co tenancy product |
| RCM / epic #702 | One claim, one invoice and related |

## Prefer include (CE core)

- App shell (`client/`, `chat-api/` CE-safe routes)
- Core database migrations (non-paid)
- CE-safe docs and local-dev tooling
- `.env.example` with CE-only placeholders

## Verify before merge

```bash
# From CE worktree — expect no matches for paid markers
rg -i 'stripe|STRIPE_|books.?match|zero-touch|write-agent|multi-company|PLAID_ENV=production' --glob '!.git'
rg -i 'sk_live_|sk_test_|whsec_|password\s*=\s*[^y]' --glob '!.git'
```

## Versioning

- Tag CE releases as `ce-vX.Y.Z`
- Record private source commit SHA in the CE PR description and optionally `SYNC-SOURCE.txt`
