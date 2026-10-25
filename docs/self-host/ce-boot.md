# CE boot walkthrough (Slice B)

**Compose file:** `docker-compose.ce.yml`  
**Env sample:** `.env.ce.example` → copy to `.env.ce` (never commit)  
**Assert:** `./scripts/assert-ce-paid-leak.sh`

## What boots in Slice B

| Service | Profile | Notes |
|---------|---------|--------|
| `database` | (default) | MSSQL on host port **14330** |
| `db-init` | `app` | Builds DACPAC + runs `scripts/deploy-db.js` |
| `dab` | `app` | Data API Builder on **5000** |
| `email-api` | `app` | Basic SMTP invoice email on **7073** (paid patient-statement / demand-package routes omitted) |
| `csv-import-api` | `app` | Bank CSV import on **7072** |

**Not in this export (HOLD):** `chat-api`, `client` (need Developer Phase 1b strip), `ma-mcp`, live QBO MCP, `monitor-agent`.

## Steps

```bash
# 0) Verify no paid leaks
./scripts/assert-ce-paid-leak.sh

# 1) Env
cp .env.ce.example .env.ce
# edit SQL_SA_PASSWORD / SMTP / optional BYO LLM as needed

# 2) Database only (smoke)
docker compose -f docker-compose.ce.yml --env-file .env.ce up database

# 3) Full Slice B app profile (db-init → dab → email-api → csv-import-api)
docker compose -f docker-compose.ce.yml --env-file .env.ce --profile app up --build
```

## Checks

- MSSQL: `localhost,14330` with `SQL_SA_PASSWORD`
- DAB: `http://localhost:5000/api` (after db-init succeeds)
- Email API: `http://localhost:7073` (health/routes per `email-api/server.js`)
- CSV import: `http://localhost:7072`

## Secrets

Never commit `.env` / `.env.ce`. Never set `STRIPE_*`, prod `PLAID_*`, agent `GITHUB_TOKEN`, or RCM join secrets in CE.

## Local auth (CE)

Slice B expects **`BYPASS_AUTH=true`** in `.env.ce` (see `.env.ce.example`). DAB host auth is **Simulator** with localhost CORS only.

The `Users` table still carries Entra/B2C-shaped columns (`EntraObjectId`, `AuthProvider` IN (`EntraID`,`B2C`)) from the private schema. That is intentional leftover shape — **do not** configure Entra ID / B2C SSO or MFA packaging in CE. Post–Dev 1b may introduce a CE-local auth story; until then treat Users rows as optional seed data, not an SSO requirement.

## DAB notes (Slice B)

- Entity `qboconnections` is **omitted** from `dab-config.json` (live QBO + tokens are out of CE). Table DDL may still exist under `database/`.
- View mappings no longer expose `PrimaryPayerName` / `PayerName` (those columns are not on `v_Invoices` / `v_Payments` / `v_CreditMemos`). Id-only payer fields remain.
