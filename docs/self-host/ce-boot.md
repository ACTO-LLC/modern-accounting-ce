# CE boot walkthrough (chat-api/client export)

**Compose file:** `docker-compose.ce.yml`  
**Env sample:** `.env.ce.example` → copy to `.env.ce` (never commit)  
**Assert:** `./scripts/assert-ce-paid-leak.sh`  
**Private source:** see `SYNC-SOURCE.txt` (Dev 1b strip @ `38e9333c`)

## What boots

| Service | Profile | Notes |
|---------|---------|--------|
| `database` | (default) | MSSQL on host port **14330** |
| `db-init` | `app` | Builds DACPAC + runs `scripts/deploy-db.js` |
| `dab` | `app` | Data API Builder on **5000** |
| `email-api` | `app` | Basic SMTP invoice email on **7073** |
| `csv-import-api` | `app` | Bank CSV import on **7072** |
| `chat-api` | `app` | Stripped API on **8080** (`CE_BUILD=true`, `BYPASS_AUTH=true`) |
| `client` | `app` | Stripped SPA on **5173** (`VITE_CE_BUILD=true`, `VITE_BYPASS_AUTH=true`) |

**Not in CE Compose:** `ma-mcp` (deferred), live QBO MCP, `monitor-agent` / write-agent.

## Steps

```bash
# 0) Verify no paid leaks
./scripts/assert-ce-paid-leak.sh

# 1) Env
cp .env.ce.example .env.ce
# edit SQL_SA_PASSWORD / SMTP / optional BYO LLM as needed

# 2) Database only (smoke)
docker compose -f docker-compose.ce.yml --env-file .env.ce up database

# 3) Full app profile (db-init → dab → email/csv → chat-api → client)
docker compose -f docker-compose.ce.yml --env-file .env.ce --profile app up --build
```

## Checks

- MSSQL: `localhost,14330` with `SQL_SA_PASSWORD`
- DAB: `http://localhost:5000/api` (after db-init succeeds)
- Email API: `http://localhost:7073`
- CSV import: `http://localhost:7072`
- chat-api: `http://localhost:8080` (must boot with `CE_BUILD=true`; setting blocked paid env keys must fail boot)
- client: `http://localhost:5173`

## Secrets

Never commit `.env` / `.env.ce`. Never set `STRIPE_*`, prod bank-link secrets, agent `GITHUB_TOKEN`, or practice-OS join secrets in CE.
