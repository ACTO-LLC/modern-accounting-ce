# Modern Accounting Community Edition

**Public CE home:** free/open core of [Modern Accounting](https://github.com/ACTO-LLC/modern-accounting) (private product).

- **License:** [AGPL-3.0](./LICENSE)
- **Attribution:** see [NOTICE](./NOTICE)
- **Sync from private:** manual process in [SYNC.md](./SYNC.md)

## What this is

Community Edition is the AGPL core intended for self-hosters and contributors. It does **not** include paid product features (Stripe Pay on Invoice, Books Match, Zero-Touch Banking, live QBO, write-agent, SSO, multi-company, RCM). Those remain in the private product.

## Status

Public CE repo with AGPL licensing, NOTICE, SYNC.md, and filtered runtime export (database, email-api, csv-import-api, dab, **stripped chat-api + client**). Self-host via `docker-compose.ce.yml` profile `app`.

## Quick start

Requires Docker (SQL Server needs about 2 GB of RAM).

```bash
./scripts/quickstart.sh --images   # pull prebuilt images (fastest)
./scripts/quickstart.sh            # or build from source (first build ~10-20 min)
```

Then open <http://localhost:5173>. Auth is bypassed by default, so there is no login. Stop with `./scripts/quickstart.sh --down`. Details: [docs/self-host/ce-boot.md](docs/self-host/ce-boot.md).

 Architect reviews export PRs before merge. Paid surfaces stay private.

## Contributing

Open issues/PRs here for CE-safe work. Paid feature requests belong in the private product process, not this repo.
