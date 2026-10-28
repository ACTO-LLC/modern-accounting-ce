# Self-host (Community Edition)

Run `./scripts/quickstart.sh` (see the CE boot walkthrough below), or use `docker-compose.ce.yml` + `.env.ce.example` at the repo root directly.

- **In CE:** single-company core ledger (when runtime tree is exported), CSV bank, basic SMTP, Milton RO BYO LLM.
- **Not in CE:** Stripe, Books Match, ZTB depth, live QBO, write monitor-agent, SSO/MFA packaging, multi-company, RCM join, managed cloud UI/SLA.
- **#630:** script-level pause/unpause only — not the productized cloud control plane.

See [ADR-0001](../architecture/adr-0001-open-core-community-edition.md) and the [CE vs paid matrix](../prd/ce-vs-paid-feature-matrix.md).

- [CE boot walkthrough](./ce-boot.md) (Slice B Compose profile `app`)
- [Quickstart, prebuilt images and CI](./quickstart-and-images.md) (maintainer notes)
