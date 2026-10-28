/**
 * Sample-data planner (issue #20).
 *
 * Pure and deterministic: given the seeded master data (accounts, customers, vendors, products),
 * a "today" date and a seed, it returns the documents to create. No I/O happens here, so the same
 * inputs always produce the same plan and the invariants can be unit tested (plan.test.mjs).
 *
 * Shape of the data, relative to today:
 *   - ~3 months of history: invoices, vendor bills, customer payments and bill payments, with
 *     paid, partially paid and open items spread across the A/R aging buckets.
 *   - The forward ~3 months come from things that are legitimately in the future: due dates on
 *     open invoices and bills (Net 15 to Net 90) and open estimates. Nothing is posted with a
 *     future date, so the P&L never shows revenue that hasn't been earned yet.
 *
 * All dates are 'YYYY-MM-DD' strings and all date math is done in UTC to avoid DST/timezone drift.
 */

export const SOURCE_SYSTEM = 'SampleData';

const DAY_MS = 86400000;

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

export function parseDate(s) {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d));
}

export function formatDate(d) {
    return d.toISOString().slice(0, 10);
}

export function addDays(s, n) {
    return formatDate(new Date(parseDate(s).getTime() + n * DAY_MS));
}

export function daysBetween(from, to) {
    return Math.round((parseDate(to) - parseDate(from)) / DAY_MS);
}

/** Same day-of-month n months away, clamped to the month's last day (Jan 31 - 1 month = Dec 31). */
export function addMonths(s, n) {
    const d = parseDate(s);
    const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
    const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
    target.setUTCDate(Math.min(d.getUTCDate(), lastDay));
    return formatDate(target);
}

const minDate = (a, b) => (a < b ? a : b);
const maxDate = (a, b) => (a > b ? a : b);

// ---------------------------------------------------------------------------
// Seeded PRNG (mulberry32): tiny, fast and good enough for sample data
// ---------------------------------------------------------------------------

export function createRng(seed) {
    let a = seed >>> 0;
    const next = () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const int = (min, max) => min + Math.floor(next() * (max - min + 1));
    return {
        next,
        int,
        amount: (min, max) => round2(min + next() * (max - min)),
        pick: (arr) => arr[Math.floor(next() * arr.length)],
        chance: (p) => next() < p,
        shuffle: (arr) => {
            const out = [...arr];
            for (let i = out.length - 1; i > 0; i--) {
                const j = Math.floor(next() * (i + 1));
                [out[i], out[j]] = [out[j], out[i]];
            }
            return out;
        },
    };
}

export const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// Deterministic v4-shaped UUIDs drawn from the same PRNG, so a given seed + today yields the same ids.
function uuidFrom(rng) {
    const hex = () => Math.floor(rng.next() * 16).toString(16);
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'
        .replace(/x/g, hex)
        .replace('y', () => (8 + Math.floor(rng.next() * 4)).toString(16))
        .toUpperCase();
}

// ---------------------------------------------------------------------------
// Behaviour profiles
// ---------------------------------------------------------------------------

/** How quickly each customer pays. Assigned round-robin over a seeded shuffle of the customers. */
const CUSTOMER_PROFILES = ['prompt', 'late', 'prompt', 'slow', 'partial', 'prompt', 'late', 'prompt'];

const CUSTOMER_TERMS = { prompt: [15, 30], late: [30], slow: [30, 45], partial: [30, 60] };

/** Recurring vendor bills, matched on vendor name; anything unmatched uses the generic profile. */
const VENDOR_PROFILES = [
    { match: /property|rent|landlord/i, kind: 'monthly', day: 1, amount: [3500, 3500], terms: 0, method: 'ACH', memo: 'Office rent' },
    { match: /power|light|utilit|electric/i, kind: 'monthly', day: 12, amount: [280, 460], terms: 21, method: 'ACH', memo: 'Electric service' },
    { match: /amazon web|aws|cloud/i, kind: 'monthly', day: 3, amount: [650, 1350], terms: 30, method: 'ACH', memo: 'Cloud hosting' },
    { match: /microsoft/i, kind: 'monthly', day: 5, amount: [264, 264], terms: 30, method: 'ACH', memo: 'Microsoft 365 (12 seats)' },
    { match: /office depot|supplies|staples/i, kind: 'sporadic', count: 3, amount: [60, 420], terms: 30, method: 'Check', memo: 'Office supplies' },
    { match: /cpa|accounting|bookkeep/i, kind: 'sporadic', count: 1, amount: [1800, 1800], terms: 15, method: 'Check', memo: 'Quarterly bookkeeping and tax review' },
    { match: /freelance|developer|design|studio|contract/i, kind: 'sporadic', count: 2, amount: [2000, 6500], terms: 15, method: 'ACH', memo: 'Subcontracted project work', subcontractor: true },
];
const GENERIC_VENDOR = { kind: 'monthly', day: 15, amount: [100, 600], method: 'Check', memo: 'Monthly services' };

const PAYMENT_METHODS = ['ACH', 'Check', 'ACH', 'Credit Card'];

export function parseTermsDays(terms) {
    if (!terms) return 30;
    if (/receipt/i.test(terms)) return 0;
    const m = String(terms).match(/(\d+)/);
    return m ? Number(m[1]) : 30;
}

/** Sensible quantities per product, so an hourly line is 8-40 hours, not 3 hours or 300. */
function quantityFor(product, rng) {
    const name = product.Name || '';
    if (/hourly|hour/i.test(name)) return rng.int(2, 10) * 4;
    if (/monthly/i.test(name)) return 1;
    if (/training/i.test(name)) return rng.int(1, 2);
    if (/enterprise/i.test(name)) return 1;
    if (/license/i.test(name)) return rng.int(1, 5);
    return rng.int(1, 3);
}

// ---------------------------------------------------------------------------
// Planner
// ---------------------------------------------------------------------------

/**
 * @param {object} input
 * @param {string} input.today        'YYYY-MM-DD'
 * @param {number} [input.seed=1]
 * @param {Array}  input.accounts     [{ Id, Code, Name, Type }]
 * @param {Array}  input.customers    [{ Id, Name }]
 * @param {Array}  input.vendors      [{ Id, Name, PaymentTerms, DefaultExpenseAccountId }]
 * @param {Array}  input.products     [{ Id, Name, Type, Description, SalesPrice, IncomeAccountId }]
 */
export function buildPlan({ today, seed = 1, accounts, customers, vendors, products }) {
    const rng = createRng(seed);
    const start = addMonths(today, -3);
    const byCode = Object.fromEntries(accounts.map((a) => [a.Code, a]));

    const cash = byCode['1000'];
    const equity = byCode['3000'];
    if (!cash || !equity) throw new Error('Chart of accounts is missing 1000 (Checking) or 3000 (Owner\'s Equity).');
    if (customers.length === 0) throw new Error('No customers found; the master-data seed has not run.');
    if (vendors.length === 0) throw new Error('No vendors found; the master-data seed has not run.');

    const sellable = products
        .filter((p) => (p.Type === 'Service' || p.Type === 'NonInventory') && Number(p.SalesPrice) > 0)
        .sort((a, b) => a.Name.localeCompare(b.Name));
    if (sellable.length === 0) throw new Error('No active Service/NonInventory products with a sales price.');

    const fallbackExpense = accounts.find((a) => a.Type === 'Expense');

    // Sort inputs so the plan doesn't depend on the order the API happened to return rows in.
    const sortedCustomers = [...customers].sort((a, b) => a.Name.localeCompare(b.Name));
    const sortedVendors = [...vendors].sort((a, b) => a.Name.localeCompare(b.Name));

    const profileOf = new Map(
        rng.shuffle(sortedCustomers).map((c, i) => [c.Id, CUSTOMER_PROFILES[i % CUSTOMER_PROFILES.length]]),
    );

    const openingBalance = {
        id: uuidFrom(rng),
        date: start,
        description: 'Opening balance: owner investment (sample data)',
        reference: 'OPENING',
        amount: 30000,
        lines: [
            { AccountId: cash.Id, Description: 'Opening cash balance', Debit: 30000, Credit: 0 },
            { AccountId: equity.Id, Description: 'Owner investment', Debit: 0, Credit: 30000 },
        ],
    };

    // ---- Invoices --------------------------------------------------------
    const invoices = [];

    const makeInvoice = (customer, issueDate, termsDays, { lineCount, forceProfile } = {}) => {
        const lines = [];
        const chosen = rng.shuffle(sellable).slice(0, lineCount ?? rng.int(1, 3));
        for (const product of chosen) {
            const quantity = quantityFor(product, rng);
            const unitPrice = round2(product.SalesPrice);
            lines.push({
                id: uuidFrom(rng),
                productServiceId: product.Id,
                description: product.Description || product.Name,
                quantity,
                unitPrice,
                amount: round2(quantity * unitPrice),
                revenueAccountId: product.IncomeAccountId || null,
            });
        }
        const total = round2(lines.reduce((s, l) => s + l.amount, 0));
        const inv = {
            id: uuidFrom(rng),
            customerId: customer.Id,
            customerName: customer.Name,
            issueDate,
            dueDate: addDays(issueDate, termsDays),
            termsDays,
            total,
            lines,
            profile: forceProfile || profileOf.get(customer.Id),
        };
        invoices.push(inv);
        return inv;
    };

    // About two invoices a week across the window, never dated after today.
    for (let weekStart = start; weekStart <= today; weekStart = addDays(weekStart, 7)) {
        const count = rng.int(1, 3);
        for (let i = 0; i < count; i++) {
            const issueDate = addDays(weekStart, rng.int(0, 4));
            if (issueDate > today) continue;
            const customer = rng.pick(sortedCustomers);
            const terms = rng.pick(CUSTOMER_TERMS[profileOf.get(customer.Id)]);
            makeInvoice(customer, issueDate, terms);
        }
    }

    // Large engagements on long terms push open A/R due dates into the coming months.
    const enterprise = sortedCustomers[rng.int(0, sortedCustomers.length - 1)];
    makeInvoice(enterprise, addDays(today, -rng.int(3, 10)), 90, { lineCount: 3, forceProfile: 'prompt' });
    makeInvoice(enterprise, addDays(today, -rng.int(20, 35)), 60, { lineCount: 2, forceProfile: 'prompt' });

    // ---- Customer payments ----------------------------------------------
    // A payment is only recorded if its date is on or before today; otherwise the invoice stays open.
    const customerPayments = [];
    const pay = (inv, date, amount) => {
        if (date > today) return;
        customerPayments.push({
            id: null, // assigned by chat-api
            date: maxDate(date, inv.issueDate),
            customerId: inv.customerId,
            invoiceId: inv.id,
            amount: round2(amount),
            method: rng.pick(PAYMENT_METHODS),
        });
    };

    for (const inv of invoices) {
        switch (inv.profile) {
            case 'prompt':
                pay(inv, addDays(inv.issueDate, rng.int(Math.min(5, inv.termsDays), Math.max(5, inv.termsDays - 2))), inv.total);
                break;
            case 'late':
                pay(inv, addDays(inv.dueDate, rng.int(10, 35)), inv.total);
                break;
            case 'slow':
                pay(inv, addDays(inv.dueDate, rng.int(45, 75)), inv.total);
                break;
            case 'partial': {
                // A deposit soon after invoicing, the balance well after the due date.
                const first = round2(inv.total * 0.4);
                pay(inv, addDays(inv.issueDate, rng.int(7, 14)), first);
                pay(inv, addDays(inv.dueDate, rng.int(20, 40)), inv.total - first);
                break;
            }
            case 'unpaid':
            default:
                break;
        }
    }

    // Guarantee the A/R aging report has something in every bucket, whatever the seed and date.
    const openBalance = (inv) =>
        round2(inv.total - customerPayments.filter((p) => p.invoiceId === inv.id).reduce((s, p) => s + p.amount, 0));
    const pastDue = (inv) => daysBetween(inv.dueDate, today);
    const buckets = [
        { min: -10000, max: 0, target: -20, terms: 30 }, // current (not yet due)
        { min: 1, max: 30, target: 12, terms: 15 },
        { min: 31, max: 60, target: 42, terms: 15 },
        { min: 61, max: 90, target: 68, terms: 15 },
    ];
    const slowCustomers = sortedCustomers.filter((c) => profileOf.get(c.Id) === 'slow');
    const delinquent = slowCustomers.length ? slowCustomers : sortedCustomers;
    for (const b of buckets) {
        const covered = invoices.some((inv) => openBalance(inv) > 0 && pastDue(inv) >= b.min && pastDue(inv) <= b.max);
        if (!covered) {
            const issueDate = addDays(today, -(b.terms + b.target));
            makeInvoice(rng.pick(delinquent), maxDate(issueDate, start), b.terms, { forceProfile: 'unpaid' });
        }
    }

    // ...and at least one partially paid invoice.
    const isPartial = (inv) => {
        const bal = openBalance(inv);
        return bal > 0 && bal < inv.total;
    };
    if (!invoices.some(isPartial)) {
        const inv = makeInvoice(rng.pick(sortedCustomers), addDays(today, -20), 30, { lineCount: 2, forceProfile: 'unpaid' });
        pay(inv, addDays(today, -8), round2(inv.total * 0.4));
    }

    // Number invoices in issue-date order, as a real business would have.
    invoices.sort((a, b) => (a.issueDate === b.issueDate ? a.id.localeCompare(b.id) : a.issueDate < b.issueDate ? -1 : 1));
    invoices.forEach((inv, i) => (inv.number = `INV-${1001 + i}`));

    // ---- Bills -----------------------------------------------------------
    const bills = [];
    const vendorSeq = new Map();
    const abbr = (name) =>
        name
            .replace(/[^A-Za-z ]/g, ' ')
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 3)
            .map((w) => w[0].toUpperCase())
            .join('');

    const makeBill = (vendor, profile, billDate, amount) => {
        const seq = (vendorSeq.get(vendor.Id) || 0) + 1;
        vendorSeq.set(vendor.Id, seq);
        const termsDays = profile.terms ?? parseTermsDays(vendor.PaymentTerms);
        const accountId = vendor.DefaultExpenseAccountId || fallbackExpense?.Id;
        if (!accountId) throw new Error(`No expense account for vendor ${vendor.Name}`);
        bills.push({
            id: uuidFrom(rng),
            vendorId: vendor.Id,
            vendorName: vendor.Name,
            number: `${abbr(vendor.Name)}-${String(1000 + seq * 7 + rng.int(0, 6))}`,
            billDate,
            dueDate: addDays(billDate, termsDays),
            terms: termsDays === 0 ? 'Due on Receipt' : `Net ${termsDays}`,
            total: round2(amount),
            memo: profile.memo,
            method: profile.method,
            subcontractor: !!profile.subcontractor,
            lines: [{ id: uuidFrom(rng), accountId, description: profile.memo, amount: round2(amount) }],
        });
    };

    for (const vendor of sortedVendors) {
        const profile = VENDOR_PROFILES.find((p) => p.match.test(vendor.Name)) || GENERIC_VENDOR;
        if (profile.kind === 'monthly') {
            const s = parseDate(start);
            for (let m = 0; m <= 3; m++) {
                const monthStart = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth() + m, 1));
                const billDate = formatDate(new Date(monthStart.getTime() + (profile.day - 1) * DAY_MS));
                if (billDate < start || billDate > today) continue;
                makeBill(vendor, profile, billDate, rng.amount(...profile.amount));
            }
        } else {
            const span = daysBetween(start, today);
            const dates = Array.from({ length: profile.count }, () => addDays(start, rng.int(0, span))).sort();
            for (const billDate of dates) makeBill(vendor, profile, billDate, rng.amount(...profile.amount));
        }
    }

    bills.sort((a, b) => (a.billDate === b.billDate ? a.id.localeCompare(b.id) : a.billDate < b.billDate ? -1 : 1));

    // ---- Bill payments ---------------------------------------------------
    // Pay on (or a few days before) the due date. One overdue subcontractor bill is left unpaid, as
    // if it were in dispute, so A/P has an overdue item too.
    const disputed = [...bills].reverse().find((b) => b.subcontractor && b.dueDate < today);
    const billPayments = [];
    for (const bill of bills) {
        if (bill === disputed) continue;
        const date = maxDate(bill.billDate, addDays(bill.dueDate, -rng.int(0, 3)));
        if (date > today) continue;
        billPayments.push({ id: null, date, vendorId: bill.vendorId, billId: bill.id, amount: bill.total, method: bill.method });
    }

    // ---- Settle running balances & statuses -----------------------------
    // Payments are applied in date order, and each carries the document's resulting AmountPaid and
    // Status so the runner can mirror what the UI's Receive Payment / Pay Bills screens write.
    customerPayments.sort((a, b) => (a.date === b.date ? a.invoiceId.localeCompare(b.invoiceId) : a.date < b.date ? -1 : 1));
    const paidSoFar = new Map();
    for (const p of customerPayments) {
        const inv = invoices.find((i) => i.id === p.invoiceId);
        const paid = round2((paidSoFar.get(inv.id) || 0) + p.amount);
        paidSoFar.set(inv.id, paid);
        p.invoiceAmountPaid = paid;
        p.invoiceStatus = paid >= inv.total ? 'Paid' : 'Partial';
    }
    for (const inv of invoices) {
        inv.amountPaid = paidSoFar.get(inv.id) || 0;
        inv.status = inv.amountPaid >= inv.total ? 'Paid' : inv.amountPaid > 0 ? 'Partial' : 'Sent';
    }
    customerPayments.forEach((p, i) => (p.number = `PMT-${String(i + 1).padStart(4, '0')}`));

    billPayments.sort((a, b) => (a.date === b.date ? a.billId.localeCompare(b.billId) : a.date < b.date ? -1 : 1));
    for (const p of billPayments) {
        p.billAmountPaid = p.amount;
        p.billStatus = 'Paid';
    }
    const paidBills = new Set(billPayments.map((p) => p.billId));
    for (const bill of bills) {
        bill.amountPaid = paidBills.has(bill.id) ? bill.total : 0;
    }
    billPayments.forEach((p, i) => (p.number = `BP-${String(i + 1).padStart(4, '0')}`));

    // ---- Estimates (forward-looking pipeline) ---------------------------
    const estimates = [];
    const estimateSpecs = [
        { daysAgo: rng.int(0, 6), valid: 30, status: 'Draft' },
        { daysAgo: rng.int(3, 12), valid: 30, status: 'Sent' },
        { daysAgo: rng.int(8, 20), valid: 60, status: 'Sent' },
        { daysAgo: rng.int(15, 28), valid: 90, status: 'Sent' },
        { daysAgo: rng.int(20, 40), valid: 60, status: 'Accepted' },
        { daysAgo: rng.int(55, 80), valid: 30, status: 'Expired' },
    ];
    for (const spec of estimateSpecs) {
        const customer = rng.pick(sortedCustomers);
        const issueDate = maxDate(addDays(today, -spec.daysAgo), start);
        const lines = rng.shuffle(sellable).slice(0, rng.int(1, 3)).map((product) => {
            const quantity = quantityFor(product, rng);
            const unitPrice = round2(product.SalesPrice);
            return {
                id: uuidFrom(rng),
                productServiceId: product.Id,
                description: product.Description || product.Name,
                quantity,
                unitPrice,
                amount: round2(quantity * unitPrice),
            };
        });
        estimates.push({
            id: uuidFrom(rng),
            customerId: customer.Id,
            issueDate,
            expirationDate: addDays(issueDate, spec.valid),
            status: spec.status,
            total: round2(lines.reduce((s, l) => s + l.amount, 0)),
            lines,
        });
    }
    estimates.sort((a, b) => (a.issueDate < b.issueDate ? -1 : a.issueDate > b.issueDate ? 1 : 0));
    estimates.forEach((e, i) => (e.number = `EST-${1001 + i}`));

    return { today, start, seed, openingBalance, invoices, customerPayments, bills, billPayments, estimates };
}

/** Totals for the console summary and for tie-out checks. */
export function summarize(plan) {
    const sum = (arr, f) => round2(arr.reduce((s, x) => s + f(x), 0));
    return {
        window: `${plan.start} .. ${plan.today}`,
        invoices: plan.invoices.length,
        invoiced: sum(plan.invoices, (i) => i.total),
        openAR: sum(plan.invoices, (i) => i.total - i.amountPaid),
        customerPayments: plan.customerPayments.length,
        bills: plan.bills.length,
        billed: sum(plan.bills, (b) => b.total),
        openAP: sum(plan.bills, (b) => b.total - b.amountPaid),
        billPayments: plan.billPayments.length,
        estimates: plan.estimates.length,
        latestDueDate: [...plan.invoices.map((i) => i.dueDate), ...plan.bills.map((b) => b.dueDate)].reduce(maxDate, plan.today),
        earliestDate: [plan.openingBalance.date, ...plan.invoices.map((i) => i.issueDate)].reduce(minDate, plan.today),
    };
}
