import { test, expect } from '@playwright/test';

/**
 * By-payer A/R aging report (issue #674).
 *
 * The `aragingbypayer` DAB entity is mocked so the test proves the page renders,
 * reads the entity, follows the OData nextLink across pages, and splits insurance
 * payer balances from patient balances into the correct buckets — without needing
 * a live DAB/DB. A pageerror listener guards against React swallowing a render
 * exception (project lesson).
 */

const PAGE_ONE = {
  value: [
    {
      PartyType: 'Payer',
      PartyId: 'payer-blue',
      PartyName: 'Blue Cross',
      InvoiceId: 'inv-1',
      InvoiceNumber: 'INV-1',
      DueDate: '2026-06-01',
      AgingDate: '2026-06-01',
      DaysPastDue: 40,
      AgingBucket: '31-60',
      OutstandingAmount: 500,
      CurrentAmount: 0,
      Days1_30: 0,
      Days31_60: 500,
      Days61_90: 0,
      Days90Plus: 0,
    },
    {
      PartyType: 'Payer',
      PartyId: 'payer-blue',
      PartyName: 'Blue Cross',
      InvoiceId: 'inv-2',
      InvoiceNumber: 'INV-2',
      DueDate: '2026-08-20',
      AgingDate: '2026-08-20',
      DaysPastDue: 5,
      AgingBucket: '1-30',
      OutstandingAmount: 200,
      CurrentAmount: 0,
      Days1_30: 200,
      Days31_60: 0,
      Days61_90: 0,
      Days90Plus: 0,
    },
  ],
  // Absolute nextLink, as DAB emits it; the page must reduce it to a relative path.
  nextLink: 'http://localhost:5173/api/aragingbypayer?$after=TOKEN2&$orderby=PartyType,PartyName',
};

const PAGE_TWO = {
  value: [
    {
      PartyType: 'Customer',
      PartyId: 'cust-doe',
      PartyName: 'Jane Doe',
      InvoiceId: 'inv-3',
      InvoiceNumber: 'INV-3',
      DueDate: '2026-03-01',
      AgingDate: '2026-05-01',
      DaysPastDue: 120,
      AgingBucket: '90+',
      OutstandingAmount: 75,
      CurrentAmount: 0,
      Days1_30: 0,
      Days31_60: 0,
      Days61_90: 0,
      Days90Plus: 75,
    },
  ],
};

test('by-payer A/R aging renders, reads the entity, paginates, and splits payer vs patient', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  let requestCount = 0;
  await page.route('**/api/aragingbypayer**', async (route) => {
    const url = route.request().url();
    requestCount += 1;
    const body = url.includes('$after=TOKEN2') ? PAGE_TWO : PAGE_ONE;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });

  await page.goto('/reports/ar-aging-by-payer');

  // Title + both section headers render.
  await expect(page.getByRole('heading', { name: 'A/R Aging by Payer' })).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole('heading', { name: 'Insurance Payers' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Patients' })).toBeVisible();

  // Both pages were fetched (nextLink was followed).
  expect(requestCount).toBeGreaterThanOrEqual(2);

  // Payer aggregated across two invoices: 500 (31-60) + 200 (1-30) = 700 total.
  await expect(page.getByRole('cell', { name: 'Blue Cross' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Total Insurance A/R' })).toBeVisible();

  // Patient side.
  await expect(page.getByRole('cell', { name: 'Jane Doe' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Total Patient A/R' })).toBeVisible();

  // Summary cards: Insurance 700, Patient 75, Total 775.
  await expect(page.getByText('$700.00').first()).toBeVisible();
  await expect(page.getByText('$75.00').first()).toBeVisible();
  await expect(page.getByText('$775.00').first()).toBeVisible();

  expect(pageErrors, `page errors: ${pageErrors.join('; ')}`).toHaveLength(0);
});

test('by-payer A/R aging shows an empty state when the entity returns no rows', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  await page.route('**/api/aragingbypayer**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ value: [] }),
    });
  });

  await page.goto('/reports/ar-aging-by-payer');

  await expect(page.getByRole('heading', { name: 'A/R Aging by Payer' })).toBeVisible({ timeout: 15000 });
  await expect(page.getByText('No outstanding receivables found.')).toBeVisible();
  expect(pageErrors, `page errors: ${pageErrors.join('; ')}`).toHaveLength(0);
});
