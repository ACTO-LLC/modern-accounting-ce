// Run with: node --test scripts/sample-data/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPlan, summarize, addMonths, addDays, daysBetween, round2 } from './plan.mjs';
import { masterData } from './fixtures.mjs';

// A spread of "today" values (month ends, leap day, year boundary) and seeds.
const TODAYS = ['2026-10-28', '2026-01-31', '2028-02-29', '2026-12-31', '2027-06-15'];
const SEEDS = [1, 2, 7, 42, 1234];

const cases = TODAYS.flatMap((today) => SEEDS.map((seed) => ({ today, seed })));
const planFor = ({ today, seed }) => buildPlan({ today, seed, ...masterData });

test('addMonths clamps to the end of shorter months', () => {
    assert.equal(addMonths('2026-05-31', -3), '2026-02-28');
    assert.equal(addMonths('2028-05-31', -3), '2028-02-29');
    assert.equal(addMonths('2026-01-15', -3), '2025-10-15');
});

test('same seed and date produce an identical plan', () => {
    assert.deepEqual(planFor(cases[0]), planFor(cases[0]));
    assert.notDeepEqual(planFor({ today: '2026-10-28', seed: 1 }), planFor({ today: '2026-10-28', seed: 2 }));
});

for (const c of cases) {
    test(`invariants hold for today=${c.today} seed=${c.seed}`, () => {
        const plan = planFor(c);
        const { today, start } = plan;

        assert.equal(start, addMonths(today, -3));

        // Nothing is posted in the future, and nothing predates the window.
        for (const inv of plan.invoices) {
            assert.ok(inv.issueDate >= start && inv.issueDate <= today, `invoice ${inv.number} dated ${inv.issueDate}`);
            assert.ok(inv.dueDate >= inv.issueDate);
        }
        for (const b of plan.bills) {
            assert.ok(b.billDate >= start && b.billDate <= today, `bill ${b.number} dated ${b.billDate}`);
        }
        for (const p of [...plan.customerPayments, ...plan.billPayments]) {
            assert.ok(p.date >= start && p.date <= today, `payment ${p.number} dated ${p.date}`);
        }
        assert.ok(plan.openingBalance.date <= plan.invoices[0].issueDate);

        // Documents add up.
        for (const doc of [...plan.invoices, ...plan.bills, ...plan.estimates]) {
            assert.equal(doc.total, round2(doc.lines.reduce((s, l) => s + l.amount, 0)));
            assert.ok(doc.total > 0);
        }

        // Payments never exceed what is owed, are applied after the document exists, and the
        // running AmountPaid/Status each payment carries ends at the document's final state.
        for (const inv of plan.invoices) {
            const pays = plan.customerPayments.filter((p) => p.invoiceId === inv.id);
            const paid = round2(pays.reduce((s, p) => s + p.amount, 0));
            assert.ok(paid <= inv.total + 0.001, `${inv.number} overpaid`);
            assert.equal(inv.amountPaid, paid);
            for (const p of pays) assert.ok(p.date >= inv.issueDate);
            if (pays.length) {
                const last = pays[pays.length - 1];
                assert.equal(last.invoiceAmountPaid, paid);
                assert.equal(last.invoiceStatus, inv.status);
            }
            assert.equal(inv.status, paid === 0 ? 'Sent' : paid >= inv.total ? 'Paid' : 'Partial');
        }
        for (const bill of plan.bills) {
            const pays = plan.billPayments.filter((p) => p.billId === bill.id);
            assert.ok(pays.length <= 1);
            assert.equal(bill.amountPaid, pays.length ? bill.total : 0);
            for (const p of pays) assert.ok(p.date >= bill.billDate);
        }

        // Numbers are unique and follow date order.
        const nums = plan.invoices.map((i) => i.number);
        assert.equal(new Set(nums).size, nums.length);
        assert.equal(new Set(plan.bills.map((b) => `${b.vendorId}:${b.number}`)).size, plan.bills.length);

        // Every A/R aging bucket has an open item, and some A/R is due beyond 45 days out.
        const open = plan.invoices.filter((i) => i.total - i.amountPaid > 0);
        const pastDue = (i) => daysBetween(i.dueDate, today);
        for (const [min, max] of [[-10000, 0], [1, 30], [31, 60], [61, 90]]) {
            assert.ok(open.some((i) => pastDue(i) >= min && pastDue(i) <= max), `no open invoice ${min}..${max} days past due`);
        }
        assert.ok(open.some((i) => i.dueDate > addDays(today, 45)), 'no open invoice due more than 45 days out');

        // Paid, partial and open invoices all appear; A/P has open bills.
        const statuses = new Set(plan.invoices.map((i) => i.status));
        for (const s of ['Paid', 'Partial', 'Sent']) assert.ok(statuses.has(s), `no ${s} invoices`);
        assert.ok(plan.bills.some((b) => b.amountPaid === 0), 'no open bills');

        // Estimates are a forward pipeline: open ones expire in the future.
        for (const e of plan.estimates.filter((e) => e.status === 'Sent' || e.status === 'Draft')) {
            assert.ok(e.expirationDate > today, `${e.number} already expired`);
        }

        // Cash never goes negative over the window (opening balance + receipts - bill payments).
        const events = [
            { date: plan.openingBalance.date, delta: plan.openingBalance.amount },
            ...plan.customerPayments.map((p) => ({ date: p.date, delta: p.amount })),
            ...plan.billPayments.map((p) => ({ date: p.date, delta: -p.amount })),
        ].sort((a, b) => (a.date === b.date ? b.delta - a.delta : a.date < b.date ? -1 : 1));
        let balance = 0;
        for (const e of events) {
            balance = round2(balance + e.delta);
            assert.ok(balance >= 0, `cash went negative (${balance}) on ${e.date}`);
        }

        // A realistic volume for a small services firm.
        const s = summarize(plan);
        assert.ok(s.invoices >= 15 && s.invoices <= 45, `${s.invoices} invoices`);
        assert.ok(s.bills >= 15 && s.bills <= 40, `${s.bills} bills`);
    });
}

test('inventory items are never invoiced (posting does not relieve inventory)', () => {
    const plan = planFor(cases[0]);
    for (const inv of plan.invoices) {
        for (const l of inv.lines) assert.notEqual(l.productServiceId, 'PROD-9');
    }
});

test('refuses to plan without the master-data seed', () => {
    assert.throws(() => buildPlan({ today: '2026-10-28', ...masterData, customers: [] }), /No customers/);
    assert.throws(() => buildPlan({ today: '2026-10-28', ...masterData, accounts: [] }), /Chart of accounts/);
});
