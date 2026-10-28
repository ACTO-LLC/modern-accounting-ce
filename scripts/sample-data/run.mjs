#!/usr/bin/env node
/**
 * Load realistic, date-relative sample data into a running Modern Accounting CE stack (issue #20).
 *
 * Everything goes through chat-api, the same way the UI does: documents are written through the
 * DAB proxy, and GL posting uses chat-api's own invoice/bill posting and payment endpoints, so the
 * General Ledger, A/R, A/P and cash all agree. It finishes by checking that tie-out.
 *
 * Zero dependencies (Node 18+). Usually run via `./scripts/quickstart.sh --demo`, which runs it in a
 * throwaway node container on the Compose network. Run it directly against published ports with:
 *
 *   node scripts/sample-data/run.mjs [--seed N] [--today YYYY-MM-DD] [--dry-run]
 *
 * Environment:
 *   API_URL   chat-api base URL (default http://localhost:8080/api)
 */
import { pathToFileURL } from 'node:url';
import { buildPlan, summarize, round2, SOURCE_SYSTEM } from './plan.mjs';

const USER = 'sample-data';

const ACCOUNT_DEFAULTS = [
    { type: 'AccountsReceivable', code: '1100', description: 'Accounts Receivable' },
    { type: 'AccountsPayable', code: '2000', description: 'Accounts Payable' },
    { type: 'DefaultRevenue', code: '4100', description: 'Service Revenue' },
    { type: 'DefaultCash', code: '1000', description: 'Checking Account' },
    { type: 'SalesTaxPayable', code: '2300', description: 'Sales Tax Payable' },
];

// Documents whose presence means the books are already in use.
const TRANSACTION_ENTITIES = ['invoices', 'bills', 'payments', 'billpayments', 'journalentries', 'estimates'];

export class EmptyDatabaseRequired extends Error {}

export function createClient(baseUrl, fetchImpl = globalThis.fetch) {
    const base = baseUrl.replace(/\/+$/, '');
    const request = async (method, path, body) => {
        const res = await fetchImpl(`${base}${path}`, {
            method,
            headers: { 'Content-Type': 'application/json', 'X-MS-API-ROLE': 'Admin' },
            body: body === undefined ? undefined : JSON.stringify(body),
        });
        const text = await res.text();
        let data = null;
        try {
            data = text ? JSON.parse(text) : null;
        } catch {
            data = text;
        }
        if (!res.ok) {
            const detail = data?.error?.message || data?.error || data?.message || text;
            throw new Error(`${method} ${path} failed (${res.status}): ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`);
        }
        return data;
    };
    // DAB pages results; follow nextLink so totals are never computed from a partial page.
    const getAll = async (path) => {
        const rows = [];
        let next = path;
        while (next) {
            const data = await request('GET', next);
            rows.push(...(data?.value || []));
            const link = data?.nextLink;
            next = link ? link.slice(link.indexOf('/api/') + 4) : null;
        }
        return rows;
    };
    return {
        get: (p) => request('GET', p),
        getAll,
        post: (p, b) => request('POST', p, b),
        put: (p, b) => request('PUT', p, b),
        patch: (p, b) => request('PATCH', p, b),
    };
}

export async function loadMasterData(api) {
    const [accounts, customers, vendors, products] = await Promise.all([
        api.getAll('/accounts'),
        api.getAll('/customers'),
        api.getAll('/vendors'),
        api.getAll("/productsservices?$filter=Status eq 'Active'"),
    ]);
    return {
        accounts,
        // Skip archived/inactive customers and vendors where the column exists.
        customers: customers.filter((c) => c.Status === undefined || c.Status === null || c.Status === 'Active'),
        vendors: vendors.filter((v) => v.Status === undefined || v.Status === null || v.Status === 'Active'),
        products,
    };
}

export async function assertNoTransactions(api) {
    const found = [];
    for (const entity of TRANSACTION_ENTITIES) {
        const data = await api.get(`/${entity}?$first=1`);
        if (data?.value?.length) found.push(entity);
    }
    if (found.length) {
        throw new EmptyDatabaseRequired(
            `This database already has transactions (${found.join(', ')}). Sample data is only loaded into ` +
                'fresh books so it never mixes with real records. To start clean, run: ./scripts/quickstart.sh --reset --demo',
        );
    }
}

export async function ensureAccountDefaults(api, accounts) {
    const current = (await api.get('/account-defaults'))?.defaults || {};
    const byCode = Object.fromEntries(accounts.map((a) => [a.Code, a]));
    for (const d of ACCOUNT_DEFAULTS) {
        if (current[d.type]) continue;
        const account = byCode[d.code];
        if (!account) throw new Error(`Account ${d.code} (${d.description}) not found; cannot set the ${d.type} default.`);
        await api.put(`/account-defaults/${d.type}`, { accountId: account.Id, description: d.description });
    }
}

export async function applyPlan(api, plan, log = console.log) {
    const ob = plan.openingBalance;
    await api.post('/postjournalentry', {
        Id: ob.id,
        TransactionDate: ob.date,
        Description: ob.description,
        Status: 'Posted',
        CreatedBy: USER,
        LinesJson: JSON.stringify(ob.lines),
        Reference: ob.reference,
        SourceSystem: SOURCE_SYSTEM,
        SourceId: 'opening-balance',
        PostedBy: USER,
    });
    log(`  Opening balance          $${ob.amount.toLocaleString()}`);

    for (const inv of plan.invoices) {
        await api.post('/invoices_write', {
            Id: inv.id,
            InvoiceNumber: inv.number,
            CustomerId: inv.customerId,
            IssueDate: inv.issueDate,
            DueDate: inv.dueDate,
            Subtotal: inv.total,
            TaxAmount: 0,
            TotalAmount: inv.total,
            AmountPaid: 0,
            Status: 'Sent',
            SourceSystem: SOURCE_SYSTEM,
            SourceId: inv.number,
        });
        for (const line of inv.lines) {
            await api.post('/invoicelines', {
                Id: line.id,
                InvoiceId: inv.id,
                ProductServiceId: line.productServiceId,
                Description: line.description,
                Quantity: line.quantity,
                UnitPrice: line.unitPrice,
                Amount: line.amount,
                RevenueAccountId: line.revenueAccountId,
                IsTaxable: false,
            });
        }
        await api.post(`/invoices/${inv.id}/post`, { userId: USER });
    }
    log(`  Invoices posted          ${plan.invoices.length}`);

    for (const bill of plan.bills) {
        await api.post('/bills_write', {
            Id: bill.id,
            VendorId: bill.vendorId,
            BillNumber: bill.number,
            BillDate: bill.billDate,
            DueDate: bill.dueDate,
            TotalAmount: bill.total,
            AmountPaid: 0,
            Status: 'Open',
            Terms: bill.terms,
            Memo: bill.memo,
            SourceSystem: SOURCE_SYSTEM,
            SourceId: bill.number,
        });
        for (const line of bill.lines) {
            await api.post('/billlines', {
                Id: line.id,
                BillId: bill.id,
                AccountId: line.accountId,
                Description: line.description,
                Amount: line.amount,
            });
        }
        await api.post(`/bills/${bill.id}/post`, { userId: USER });
    }
    log(`  Bills posted             ${plan.bills.length}`);

    const cashId = plan.openingBalance.lines[0].AccountId;

    // chat-api's payment endpoints write the payment, its application and the GL entry, but (like the
    // UI's Receive Payment / Pay Bills screens) leave the document's AmountPaid/Status to the caller.
    for (const p of plan.customerPayments) {
        const res = await api.post('/payments', {
            customerId: p.customerId,
            paymentDate: p.date,
            totalAmount: p.amount,
            paymentMethod: p.method,
            depositAccountId: cashId,
            memo: 'Thank you for your payment',
            applications: [{ invoiceId: p.invoiceId, amountApplied: p.amount }],
            userId: USER,
        });
        if (res?.paymentId) {
            await api.patch(`/payments_write/Id/${res.paymentId}`, { PaymentNumber: p.number, SourceSystem: SOURCE_SYSTEM, SourceId: p.number });
        }
        await api.patch(`/invoices_write/Id/${p.invoiceId}`, { AmountPaid: p.invoiceAmountPaid, Status: p.invoiceStatus });
    }
    log(`  Customer payments        ${plan.customerPayments.length}`);

    for (const p of plan.billPayments) {
        const res = await api.post('/billpayments', {
            vendorId: p.vendorId,
            paymentDate: p.date,
            totalAmount: p.amount,
            paymentMethod: p.method,
            paymentAccountId: cashId,
            applications: [{ billId: p.billId, amountApplied: p.amount }],
            userId: USER,
        });
        if (res?.billPaymentId) {
            await api.patch(`/billpayments_write/Id/${res.billPaymentId}`, { PaymentNumber: p.number, SourceSystem: SOURCE_SYSTEM, SourceId: p.number });
        }
        await api.patch(`/bills_write/Id/${p.billId}`, { AmountPaid: p.billAmountPaid, Status: p.billStatus });
    }
    log(`  Bill payments            ${plan.billPayments.length}`);

    for (const est of plan.estimates) {
        await api.post('/estimates_write', {
            Id: est.id,
            EstimateNumber: est.number,
            CustomerId: est.customerId,
            IssueDate: est.issueDate,
            ExpirationDate: est.expirationDate,
            TotalAmount: est.total,
            Status: est.status,
        });
        for (const line of est.lines) {
            await api.post('/estimatelines', {
                Id: line.id,
                EstimateId: est.id,
                ProductServiceId: line.productServiceId,
                Description: line.description,
                Quantity: line.quantity,
                UnitPrice: line.unitPrice,
                Amount: line.amount,
            });
        }
    }
    log(`  Estimates                ${plan.estimates.length}`);
}

/**
 * Check that the subledgers agree with the General Ledger: open invoice balances = A/R account
 * balance, open bill balances = A/P account balance. Returns the figures; throws on a mismatch.
 */
export async function verifyTieOut(api) {
    const defaults = (await api.get('/account-defaults'))?.defaults || {};
    const balanceOf = async (accountId) => {
        const lines = await api.getAll(`/journalentrylines?$filter=AccountId eq ${accountId}`);
        return round2(lines.reduce((s, l) => s + Number(l.Debit || 0) - Number(l.Credit || 0), 0));
    };
    const invoices = await api.getAll('/invoices');
    const bills = await api.getAll('/bills');
    const openAR = round2(invoices.reduce((s, i) => s + Number(i.TotalAmount) - Number(i.AmountPaid), 0));
    const openAP = round2(bills.reduce((s, b) => s + Number(b.TotalAmount) - Number(b.AmountPaid), 0));
    const glAR = await balanceOf(defaults.AccountsReceivable.accountId);
    const glAP = -(await balanceOf(defaults.AccountsPayable.accountId));
    const result = { openAR, glAR, openAP, glAP, invoices: invoices.length, bills: bills.length };
    const problems = [];
    if (Math.abs(openAR - glAR) > 0.01) problems.push(`A/R subledger ${openAR} != GL ${glAR}`);
    if (Math.abs(openAP - glAP) > 0.01) problems.push(`A/P subledger ${openAP} != GL ${glAP}`);
    if (problems.length) throw new Error(`Tie-out failed: ${problems.join('; ')}`);
    return result;
}

function parseArgs(argv) {
    const opts = { seed: 1, today: null, dryRun: false, verifyOnly: false };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--seed') opts.seed = Number(argv[++i]);
        else if (a === '--today') opts.today = argv[++i];
        else if (a === '--dry-run') opts.dryRun = true;
        else if (a === '--verify') opts.verifyOnly = true;
        else if (a === '-h' || a === '--help') opts.help = true;
        else throw new Error(`Unknown option: ${a}`);
    }
    if (!Number.isInteger(opts.seed)) throw new Error('--seed must be an integer');
    if (opts.today && !/^\d{4}-\d{2}-\d{2}$/.test(opts.today)) throw new Error('--today must be YYYY-MM-DD');
    return opts;
}

function localToday() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const money = (n) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

async function main() {
    const opts = parseArgs(process.argv.slice(2));
    if (opts.help) {
        console.log(`Load date-relative sample data (about 3 months of history plus open items due over the next 3).

Usage: node scripts/sample-data/run.mjs [--seed N] [--today YYYY-MM-DD] [--dry-run] [--verify]

  --seed N      Vary the generated data (default 1). The same seed and date give the same data.
  --today DATE  Generate as if today were DATE (default: the local date).
  --dry-run     Print what would be created, using the API for master data; writes nothing.
  --verify      Only check that A/R and A/P tie to the General Ledger.

Only runs against a database with no transactions. Start clean with: ./scripts/quickstart.sh --reset --demo
Env: API_URL (default http://localhost:8080/api)`);
        return;
    }

    const api = createClient(process.env.API_URL || 'http://localhost:8080/api');

    if (opts.verifyOnly) {
        const r = await verifyTieOut(api);
        console.log(`A/R ${money(r.openAR)} and A/P ${money(r.openAP)} tie to the General Ledger.`);
        return;
    }

    const today = opts.today || localToday();
    const master = await loadMasterData(api);
    const plan = buildPlan({ today, seed: opts.seed, ...master });
    const s = summarize(plan);

    console.log(`Sample data for ${s.window} (seed ${opts.seed}); open items due through ${s.latestDueDate}`);
    console.log(`  ${s.invoices} invoices ${money(s.invoiced)} (open A/R ${money(s.openAR)}), ${s.bills} bills ${money(s.billed)} (open A/P ${money(s.openAP)}), ${s.estimates} estimates`);
    if (opts.dryRun) {
        console.log('Dry run: nothing written.');
        return;
    }

    await assertNoTransactions(api);
    await ensureAccountDefaults(api, master.accounts);
    await applyPlan(api, plan);
    const r = await verifyTieOut(api);
    console.log(`Done. A/R ${money(r.openAR)} and A/P ${money(r.openAP)} tie to the General Ledger.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    main().catch((err) => {
        console.error(`\n${err instanceof EmptyDatabaseRequired ? '' : 'Error: '}${err.message}`);
        if (!(err instanceof EmptyDatabaseRequired)) {
            console.error('If this stopped part-way, the books now hold partial sample data. Start clean with: ./scripts/quickstart.sh --reset --demo');
        }
        process.exit(1);
    });
}
