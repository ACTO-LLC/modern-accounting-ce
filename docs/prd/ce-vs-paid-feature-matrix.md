# CE vs Paid — feature matrix

**Status:** Locked with [ADR-0001](../architecture/adr-0001-open-core-community-edition.md) (Accept with amend, 2026-10-24)  
**License:** Community Edition = **AGPL-3.0**; ACTO-hosted / OEM / commercial add-ons = separate commercial license  
**Owner:** MA Product Owner  
**Audience:** Marketing, website, README, sales — keep copy aligned here

---

## One-line promises

| Edition | Promise |
|---------|---------|
| **Community Edition (CE)** | QBO escape hatch you control — single-company books, self-host, own your data |
| **Paid / hosted** | Leave QBO in a weekend — get paid, books match, bank itself (+ Practice OS / RCM when sold) |

Do **not** use “guarantee” language on CE. Prefer “Books Match” only for paid Switch / Books Match.

---

## Matrix

| Capability | CE | Paid / hosted |
|------------|:--:|:-------------:|
| Core ledger (COA, journals, invoices / bills / estimates, AR/AP, standard reports) | ✅ | ✅ |
| Single-company | ✅ | ✅ |
| Multi-company / tenancy hardening | — | ✅ |
| Docker Compose one-box self-host | ✅ | ✅ (optional) |
| Local / simple auth | ✅ | ✅ |
| Entra ID / B2C SSO, MFA packaging | — | ✅ |
| CSV bank import | ✅ | ✅ |
| Basic SMTP invoice email | ✅ | ✅ |
| Milton read-only Q&A (BYO LLM key) | ✅ | ✅ |
| Monitor-agent that writes code / opens PRs | — | ✅ |
| **Pay on Invoice** (Stripe Checkout, webhooks, settings) | — | ✅ |
| **Switch / Books Match** | — | ✅ |
| **Zero-Touch Banking** (confidence approve, weekly brief, prod Plaid packaging) | — | ✅ |
| Live QBO sync | — | ✅ |
| One-shot QBO import/export | ✅ (optional) | ✅ |
| **Practice OS / medical RCM join** (Fluent MedOps ↔ MA, ClaimId / #702-class) | — | ✅ |
| Managed cloud start/pause UI + SLA (#630 productized) | scripts only | ✅ |
| Support SLA / ACTO control plane | — | ✅ |

---

## Architecture reminders (for eng + Marketing)

1. CE builds **strip or stub** paid packages — not UI-only hides.
2. No Stripe secrets, payment webhooks, agent GitHub write paths, or RCM join adapters as dead code in CE images.
3. One schema family; paid features are modules / gated packages.

---

## Website / README copy starters

**CE:** Self-host Modern Accounting under AGPL-3.0. Own your ledger on your Docker box. Bring your own LLM key for read-only Milton Q&A.

**Paid:** Everything in CE, plus get paid on invoices, Books Match cutover, Zero-Touch Banking, SSO, multi-company, and Practice OS claim→invoice join when you need medical A/R.

---

## Related

- ADR: `docs/architecture/adr-0001-open-core-community-edition.md`
- Private commercial product: [`ACTO-LLC/modern-accounting`](https://github.com/ACTO-LLC/modern-accounting)
- One claim epic: [#702](https://github.com/ACTO-LLC/modern-accounting/issues/702)
