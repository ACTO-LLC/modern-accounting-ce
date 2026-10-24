# ADR-0001: Open-core Community Edition

**Status:** Accepted  
**Date:** 2026-10-24 (America/Los_Angeles)  
**Author:** MA Architect  
**Deciders:** MA Owner, MA Product Owner (consult: Marketing, DevOps, Developer)

**Locked 2026-10-24 (Owner confirm):** Accept with amend.
1. CE license **AGPL-3.0**; separate **commercial** license for ACTO-hosted/OEM (not BUSL).
2. CE vs paid as drafted, **plus** Practice OS / medical RCM join (#702-class) stays **paid — not in CE**.

**Feature matrix (PO):** [`docs/prd/ce-vs-paid-feature-matrix.md`](../prd/ce-vs-paid-feature-matrix.md)

---

## Context

Modern Accounting already positions as “own your data / self-host anywhere.” An **open-core Community Edition (CE)** would make that credible in public, grow distribution, and reserve paid value for the conversion trilogy, Practice OS / medical RCM join, and managed/cloud offerings.

This ADR records the cut between CE and commercial/hosted product so engineering can build module boundaries before a public launch.

Related: [#630](https://github.com/ACTO-LLC/modern-accounting/issues/630) (cloud pause/unpause UI + optional usage-based auto-pause), Conversion Trilogy PRD (`docs/prd/conversion-trilogy-prd.md`), One claim epic [#702](https://github.com/ACTO-LLC/modern-accounting/issues/702), CE vs paid matrix (`docs/prd/ce-vs-paid-feature-matrix.md`), enterprise readiness (`docs/architecture/enterprise-readiness-review.md`).

---

## Decision

**Pursue open-core**, with a hard line on what stays closed. Do **not** open-source the full monorepo as-is.

### Licensing (locked)

| Surface | License |
|---------|---------|
| CE core (public) | **AGPL-3.0** |
| ACTO-hosted / OEM / commercial add-ons | Separate **commercial** license |

Rationale: AGPL discourages closed SaaS forks without contribution; commercial license covers ACTO-hosted and OEM. BUSL was considered and **rejected** for CE.

### Community Edition — in scope

- Core ledger: COA, journal entries, invoices / bills / estimates, AR/AP, standard reports
- **Single-company** deployments only
- Docker Compose one-box local / self-host
- Local / development auth (documented; production CE may allow simple local accounts — Entra/B2C stays paid)
- CSV bank import
- Basic SMTP invoice email
- Milton **read-only** Q&A against the customer’s own books (**BYO** LLM API key)
- Docs for self-host, including cost-control ops (ties to #630 scripts / status)

### Commercial / hosted — out of CE

- Multi-company + tenancy enforcement hardening
- **Pay on Invoice** (Stripe Checkout, webhooks, settings)
- **Switch Guarantee / Books Match**
- **Zero-Touch Banking** depth (confidence approve-all, weekly brief, prod Plaid packaging)
- Live QBO sync (optional: CE gets **one-shot** import/export only)
- **Monitor-agent** that writes code / opens PRs (self-evolving admin)
- Entra ID / B2C SSO, MFA product packaging
- **Practice OS / medical RCM join** (Fluent MedOps ↔ MA, ClaimId / #702-class) — paid only; do not ship this join in CE
- Managed cloud start/pause UI and SLA (#630 productized)
- Support SLA / ACTO-hosted control plane

### Architecture rules

1. **One schema family** — no permanent CE fork of the database; paid capabilities are modules/migrations gated by license or separate packages.
2. **Feature flags + package boundaries** — follow patterns like `JobCostingEnabled`; CE builds must **strip or stub** paid packages, not only hide UI.
3. **No security by obscurity** — Stripe secrets, payment webhooks, agent GitHub write paths, RCM join adapters, and multi-tenant controls must not ship as dead code in CE images.
4. **Distribution** — public CE repo (or public `ce/` release train); commercial add-ons private or commercially licensed.

### Positioning

| Edition | Promise |
|---------|---------|
| CE | “QBO escape hatch you control” |
| Paid / hosted | “Leave QBO in a weekend — get paid, books match, bank itself” (+ Practice OS / RCM when sold) |

---

## Consequences

### Positive

- Aligns marketing with self-host story; lowers trial friction
- Forces clean module boundaries (good for security and extensibility anyway)
- Community can fix CE bugs; AGPL returns improvements to the commons
- Clear moat: trilogy + RCM join + write-agent stay commercial

### Negative / costs

- Support and docs burden for strangers on Docker + SQL
- Risk of competitors packaging CE + thin SaaS (mitigated by AGPL + closed trilogy/RCM/agent)
- Engineering cost to split packages and CI (CE vs commercial images)
- Must harden or withhold monitor-agent before any public write-capable agent ships

### Follow-ups

- [x] Owner confirms Accept-with-amend (this document)
- [x] Add `LICENSE` (AGPL-3.0) + commercial license notice for add-ons (CE public repo)
- [x] PO publishes CE vs Paid feature matrix (`docs/prd/ce-vs-paid-feature-matrix.md`)
- [ ] DevOps: CE Docker image + release pipeline; strip paid env/secrets/RCM join from CE
- [ ] Developer: module seams for payments, Books Match, Zero-Touch, monitor-agent, Practice OS/RCM join
- [ ] Security pass on what remains in CE (#667-class MCP/auth issues before public)
- [ ] Marketing: CE vs paid messaging; no “guarantee” language on CE
- [x] Decision on public repo home (`ACTO-LLC/modern-accounting-ce`)

---

## Alternatives considered

1. **Fully closed source** — simplest IP control; weakens “no lock-in” claim; slower adoption.
2. **Fully open (MIT/Apache)** — max adoption; hard to monetize trilogy/agent/RCM; easy SaaS skimming.
3. **BUSL → OSS later** — considered for CE; **rejected** in favor of AGPL-3.0 now.
4. **Source-available only (no OSS)** — less community goodwill than AGPL open-core.
5. **Open everything except hosted ops** — leaves payments/agent/RCM copyable; weak moat.

---

## Notes

Clock-based Azure Automation start/stop and SQL serverless auto-pause are **ops** concerns, not CE license boundaries. Usage-based auto-pause after N minutes (#630) is a product/config feature that can exist in paid/hosted first, with CE getting script-level pause/unpause.
