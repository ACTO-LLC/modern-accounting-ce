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

## Quick start

```bash
./scripts/quickstart.sh            # build from source
./scripts/quickstart.sh --images   # pull prebuilt GHCR images instead (much faster)
./scripts/quickstart.sh --demo     # also load sample invoices, bills and payments (see below)
./scripts/quickstart.sh --down     # stop (data volume is kept)
```

It copies `.env.ce.example` to `.env.ce` if missing, starts the `app` profile, waits for DAB, chat-api and the client to respond, then prints the URL.

**What you should see:** open <http://localhost:5173>. Auth is bypassed (`BYPASS_AUTH=true`), so the app loads straight into the UI with no login. `db-init` deploys the schema plus starter master data: a chart of accounts, 8 customers, 8 vendors, products and services, and a few projects. There are no transactions, so the dashboard and A/R / A/P are empty until you add some or load [sample data](#sample-data-and-starting-clean). First run from source takes roughly 10-20 minutes on a cold Docker cache (SQL Server, .NET SDK and DAB images plus `npm ci` in four services); expect 2 GB+ of RAM for SQL Server.

## Windows

**Preferred:** use WSL2. The quickstart script is bash and does not run in PowerShell or `cmd`.

1. Install Docker Desktop and enable **Settings, General, Use the WSL 2 based engine**, then enable your distro under **Settings, Resources, WSL integration**.
2. Install WSL2 with Ubuntu if you don't have it (admin PowerShell, then reboot): `wsl --install -d Ubuntu`.
3. SQL Server needs about 2 GB of RAM or more. If the stack won't start, raise WSL's limit in `%UserProfile%\.wslconfig` (for example `[wsl2]` then `memory=6GB`), run `wsl --shutdown`, and restart Docker Desktop.
4. Clone **inside WSL** (your Linux home folder, not `/mnt/c/...`) and run the quickstart there:

```bash
cd ~ && git clone https://github.com/ACTO-LLC/modern-accounting-ce.git
```

```bash
cd modern-accounting-ce && ./scripts/quickstart.sh --images
```

5. Open <http://localhost:5173> in your normal Windows browser; WSL2 forwards localhost.

Files on the Windows drive are slow, and Windows Git can convert line endings to CRLF, which breaks the scripts with errors like `bad interpreter` or `\r`. If you see those, re-clone from inside WSL.

**PowerShell alternative:** if the repo is already on a Windows path and you only need Compose (not `quickstart.sh`):

```powershell
Copy-Item .env.ce.example .env.ce -ErrorAction SilentlyContinue
docker compose -f docker-compose.ce.yml -f docker-compose.ce.images.yml --env-file .env.ce --profile app up -d
```

You still need Docker Desktop with the WSL2 engine. Prefer the WSL clone + `./scripts/quickstart.sh` path for first-time installs.

## Verify it works

CI only checks that the services respond. After a first install, or after bumping the DAB image, click through the app once:

1. <http://localhost:5173> loads with no login screen.
2. List pages (customers, invoices, accounts) load without error banners. Customers and accounts show the starter master data; invoices are empty unless you loaded sample data.
3. Create a record (for example a customer) and refresh. It should persist. This proves reads and writes through DAB work.
4. <http://localhost:5000/api/openapi> returns JSON.

If something fails, check DAB's logs and include them in any bug report:

```bash
docker compose -f docker-compose.ce.yml --env-file .env.ce --profile app logs dab
```

## Sample data and starting clean

To try the app with realistic books, load sample data. It is generated relative to the day you run it, so the dashboard always looks current:

- About 3 months of history: invoices, vendor bills (rent, utilities, cloud, software, subcontractors), customer payments and bill payments. Some invoices are paid, some partially paid, and some overdue in each A/R aging bucket; one subcontractor bill is overdue in A/P.
- The next 3 months come from open items: invoice and bill due dates (Net 15 to Net 90) and open estimates. Nothing is posted with a future date, so the P&L never shows revenue that hasn't been earned.
- Everything is posted through the app's own invoice, bill and payment posting, and the loader finishes by checking that A/R and A/P tie to the General Ledger.

```bash
./scripts/quickstart.sh --demo
```

The loader only runs against books with **no transactions**, so it never mixes with real records. Sample documents are tagged `SourceSystem = 'SampleData'`. `SAMPLE_DATA_SEED=2 ./scripts/quickstart.sh --demo` gives a different (but repeatable) data set.

To throw everything away and start with clean books (for example before entering real data, or to reload sample data), use `--reset`. It **permanently deletes the database volume**, asks you to type `reset` to confirm, then redeploys the schema and starter master data:

```bash
./scripts/quickstart.sh --reset
```

```bash
./scripts/quickstart.sh --reset --demo
```

Without a terminal (CI, scripts), add `--yes` to confirm. To run the loader yourself against a running stack, use `docker compose -f docker-compose.ce.yml --env-file .env.ce run --rm sample-data --help`, or `node scripts/sample-data/run.mjs --help` (Node 18+) against the published ports.

## Troubleshooting

### Port already in use (`14330`, `5173`, `5000`, …)

Compose publishes SQL on **14330**, DAB on **5000**, csv-import on **7072**, email-api on **7073**, chat-api on **8080**, and the client on **5173**. If Docker reports `bind: Only one usage of each socket address…`, something else on the host already holds that port.

```bash
docker ps --filter publish=14330
# Windows PowerShell:
# Get-NetTCPConnection -LocalPort 14330 -ErrorAction SilentlyContinue
```

Stop the conflicting container or process, or change the left-hand side of the port mapping in `docker-compose.ce.yml` (and matching URLs in `.env.ce`).

### FQDN returns 403 / `Blocked request. This host is not allowed`

Vite's host allowlist rejects unknown `Host` headers. CE allows `host.docker.internal` and (for CE builds) `*.cloudapp.azure.com`. Raw IPs work without that list.

- Prefer plain **`http://`** (no TLS on `:5173` / `:5000`). `https://` yields `ERR_SSL_PROTOCOL_ERROR` and looks like DNS failure.
- Azure VM example: `http://<vm>.westus2.cloudapp.azure.com:5173` or `http://<public-ip>:5173`.
- If you still 403 on a custom hostname, add it under `server.allowedHosts` in `client/vite.config.ts` (leading-dot suffix match is supported) and recreate the client.

### Red Vite error overlay on `:5173`

Usually a stale prebuilt `client` image (missing CE stubs) or a failed module resolve. Pull again, or build the client from source:

```bash
docker compose -f docker-compose.ce.yml -f docker-compose.ce.images.yml --env-file .env.ce --profile app pull client
docker compose -f docker-compose.ce.yml -f docker-compose.ce.images.yml --env-file .env.ce --profile app up -d --force-recreate client
```

```bash
docker compose -f docker-compose.ce.yml --env-file .env.ce --profile app up -d --build --force-recreate client
```

Hard-refresh the browser after recreate.

### List pages show errors but `:8080/api/health` is fine

The SPA calls `/api` on the Vite dev server; Vite proxies to chat-api. Inside Compose that proxy must use Docker service DNS (`http://chat-api:8080`), not `localhost` (that is the client container). `docker-compose.ce.yml` sets `DEV_PROXY_API_URL` / `DEV_PROXY_EMAIL_URL` for this. Confirm they are present:

```bash
docker exec ma-ce-client printenv DEV_PROXY_API_URL DEV_PROXY_EMAIL_URL
```

Then:

```bash
curl -fsS http://localhost:5173/api/health
curl -fsS http://localhost:5173/api/accounts
```

If the direct chat-api health check works but these fail, recreate the client after pulling this repo revision.

## SQL Server edition and licensing

The `database` container runs SQL Server 2022 as **Express** by default (`MSSQL_PID=Express`), which is free for production use but capped at 10 GB per database, roughly 1.4 GB of buffer pool memory and 4 CPU cores. That is ample for a single-company ledger; if you outgrow it, set `MSSQL_PID` in `.env.ce` to an edition you hold a license for (for example `Standard`).

The SQL Server image's own default is Developer, which Microsoft licenses for non-production use only, so don't rely on it for a live deployment. Check Microsoft's licensing terms for your situation; this is not legal advice.

## Manual steps

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

# Or pull prebuilt images instead of building
docker compose -f docker-compose.ce.yml -f docker-compose.ce.images.yml --env-file .env.ce --profile app up -d
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
