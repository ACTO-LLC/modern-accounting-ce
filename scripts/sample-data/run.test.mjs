// Runner tests against an in-memory stand-in for chat-api + DAB. The fake mimics the posting
// behaviour of chat-api/journal-entry-service.js closely enough to check the call sequence and the
// A/R / A/P tie-out; the CE boot workflow exercises the real stack.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient, loadMasterData, assertNoTransactions, ensureAccountDefaults, applyPlan, verifyTieOut, EmptyDatabaseRequired } from './run.mjs';
import { buildPlan } from './plan.mjs';
import { masterData } from './fixtures.mjs';

function fakeApi({ preexisting = {} } = {}) {
    const db = {
        accounts: masterData.accounts.map((a) => ({ ...a })),
        customers: masterData.customers.map((c) => ({ ...c, Status: 'Active' })),
        vendors: masterData.vendors.map((v) => ({ ...v, Status: 'Active' })),
        productsservices: masterData.products.map((p) => ({ ...p, Status: 'Active' })),
        accountdefaults: [],
        invoices: [], invoicelines: [], bills: [], billlines: [], payments: [], billpayments: [],
        journalentries: [], journalentrylines: [], estimates: [], estimatelines: [],
        ...preexisting,
    };
    const calls = [];
    const defaults = () => Object.fromEntries(db.accountdefaults.map((d) => [d.AccountType, { accountId: d.AccountId }]));
    const postJE = (date, lines) => {
        const id = `JE-${db.journalentries.length + 1}`;
        db.journalentries.push({ Id: id, TransactionDate: date });
        const dr = lines.reduce((s, l) => s + (l.Debit || 0), 0);
        const cr = lines.reduce((s, l) => s + (l.Credit || 0), 0);
        assert.ok(Math.abs(dr - cr) < 0.0001, `unbalanced JE on ${date}: ${dr} vs ${cr}`);
        for (const l of lines) db.journalentrylines.push({ JournalEntryId: id, ...l });
        return id;
    };
    const table = { invoices_write: 'invoices', bills_write: 'bills', payments_write: 'payments', billpayments_write: 'billpayments', estimates_write: 'estimates' };

    const handle = (method, path, body) => {
        calls.push(`${method} ${path.split('?')[0].replace(/[0-9A-F-]{36}/g, ':id')}`);
        const [route, query = ''] = path.split('?');
        const parts = route.split('/').filter(Boolean);
        const filter = decodeURIComponent(query).match(/\$filter=(\w+) eq '?([^'&]+)'?/);
        if (method === 'GET' && route === '/account-defaults') return { success: true, defaults: defaults() };
        if (method === 'PUT' && parts[0] === 'account-defaults') {
            db.accountdefaults.push({ AccountType: parts[1], AccountId: body.accountId });
            return { success: true };
        }
        if (method === 'GET') {
            let rows = db[parts[0]] || [];
            if (filter) rows = rows.filter((r) => String(r[filter[1]]) === filter[2]);
            if (query.includes('$first=1')) rows = rows.slice(0, 1);
            return { value: rows };
        }
        if (method === 'POST' && route === '/postjournalentry') {
            postJE(body.TransactionDate, JSON.parse(body.LinesJson));
            return { value: [{ JournalEntryId: body.Id }] };
        }
        if (method === 'POST' && parts[0] === 'invoices' && parts[2] === 'post') {
            const inv = db.invoices.find((i) => i.Id === parts[1]);
            const lines = db.invoicelines.filter((l) => l.InvoiceId === inv.Id);
            inv.JournalEntryId = postJE(inv.IssueDate, [
                { AccountId: defaults().AccountsReceivable.accountId, Debit: inv.TotalAmount, Credit: 0 },
                ...lines.map((l) => ({ AccountId: l.RevenueAccountId || defaults().DefaultRevenue.accountId, Debit: 0, Credit: l.Amount })),
            ]);
            return { success: true };
        }
        if (method === 'POST' && parts[0] === 'bills' && parts[2] === 'post') {
            const bill = db.bills.find((b) => b.Id === parts[1]);
            const lines = db.billlines.filter((l) => l.BillId === bill.Id);
            bill.JournalEntryId = postJE(bill.BillDate, [
                ...lines.map((l) => ({ AccountId: l.AccountId, Debit: l.Amount, Credit: 0 })),
                { AccountId: defaults().AccountsPayable.accountId, Debit: 0, Credit: bill.TotalAmount },
            ]);
            bill.Status = 'Posted';
            return { success: true };
        }
        if (method === 'POST' && route === '/payments') {
            const paymentId = `PAY-${db.payments.length + 1}`;
            postJE(body.paymentDate, [
                { AccountId: body.depositAccountId, Debit: body.totalAmount, Credit: 0 },
                { AccountId: defaults().AccountsReceivable.accountId, Debit: 0, Credit: body.totalAmount },
            ]);
            db.payments.push({ Id: paymentId, PaymentNumber: `PMT-${Date.now()}` });
            return { success: true, paymentId };
        }
        if (method === 'POST' && route === '/billpayments') {
            const billPaymentId = `BPAY-${db.billpayments.length + 1}`;
            postJE(body.paymentDate, [
                { AccountId: defaults().AccountsPayable.accountId, Debit: body.totalAmount, Credit: 0 },
                { AccountId: body.paymentAccountId, Debit: 0, Credit: body.totalAmount },
            ]);
            db.billpayments.push({ Id: billPaymentId });
            return { success: true, billPaymentId };
        }
        if (method === 'POST') {
            db[table[parts[0]] || parts[0]].push({ ...body });
            return { value: [body] };
        }
        if (method === 'PATCH') {
            const row = db[table[parts[0]] || parts[0]].find((r) => r.Id === parts[2]);
            assert.ok(row, `PATCH target missing: ${path}`);
            Object.assign(row, body);
            return { value: [row] };
        }
        throw new Error(`fake: unhandled ${method} ${path}`);
    };

    const fetchImpl = async (url, init) => {
        const path = url.replace('http://fake/api', '');
        try {
            const data = handle(init.method, path, init.body ? JSON.parse(init.body) : undefined);
            return { ok: true, status: 200, text: async () => JSON.stringify(data) };
        } catch (err) {
            if (err instanceof assert.AssertionError) throw err;
            return { ok: false, status: 500, text: async () => JSON.stringify({ error: err.message }) };
        }
    };
    return { api: createClient('http://fake/api/', fetchImpl), db, calls };
}

test('loads sample data end to end and the subledgers tie to the GL', async () => {
    const { api, db, calls } = fakeApi();
    const master = await loadMasterData(api);
    await assertNoTransactions(api);
    await ensureAccountDefaults(api, master.accounts);
    assert.equal(db.accountdefaults.length, 5);

    const plan = buildPlan({ today: '2026-10-28', seed: 1, ...master });
    await applyPlan(api, plan, () => {});
    const r = await verifyTieOut(api);

    assert.equal(r.invoices, plan.invoices.length);
    assert.ok(r.openAR > 0 && r.openAP > 0);
    // Every invoice and bill went through chat-api posting, not straight into the GL.
    assert.equal(calls.filter((c) => c === 'POST /invoices/:id/post').length, plan.invoices.length);
    assert.equal(calls.filter((c) => c === 'POST /bills/:id/post').length, plan.bills.length);
    // Payment numbers were renumbered from chat-api's timestamp style to a readable sequence.
    assert.equal(db.payments[0].PaymentNumber, 'PMT-0001');
    assert.ok(db.invoices.every((i) => i.JournalEntryId));
});

test('keeps existing account defaults', async () => {
    const { api, db } = fakeApi({ preexisting: { accountdefaults: [{ AccountType: 'DefaultCash', AccountId: 'ACCT-1010' }] } });
    await ensureAccountDefaults(api, masterData.accounts);
    assert.equal(db.accountdefaults.filter((d) => d.AccountType === 'DefaultCash').length, 1);
    assert.equal(db.accountdefaults.find((d) => d.AccountType === 'DefaultCash').AccountId, 'ACCT-1010');
});

test('refuses to touch books that already have transactions', async () => {
    const { api, calls } = fakeApi({ preexisting: { invoices: [{ Id: 'X', TotalAmount: 10, AmountPaid: 0 }] } });
    await assert.rejects(assertNoTransactions(api), EmptyDatabaseRequired);
    assert.ok(calls.every((c) => c.startsWith('GET')), 'nothing written');
});

test('tie-out detects a subledger that disagrees with the GL', async () => {
    const { api, db } = fakeApi();
    const master = await loadMasterData(api);
    await ensureAccountDefaults(api, master.accounts);
    await applyPlan(api, buildPlan({ today: '2026-10-28', seed: 3, ...master }), () => {});
    db.invoices[0].AmountPaid = 0.5; // drift the subledger
    db.invoices[0].TotalAmount += 100;
    await assert.rejects(verifyTieOut(api), /A\/R subledger/);
});

test('surfaces API errors with method, path and status', async () => {
    const api = createClient('http://x/api', async () => ({ ok: false, status: 400, text: async () => '{"error":"Invoice has no lines"}' }));
    await assert.rejects(api.post('/invoices/1/post', {}), /POST \/invoices\/1\/post failed \(400\): Invoice has no lines/);
});
