import { test, expect } from '@playwright/test';

/**
 * Patient Statements + dunning (issue #675).
 *
 * DAB `customers` and `patientstatement` are mocked, and the email-api dunning calls are stubbed, so the
 * test proves the page renders, reads the patient-statement entity, and shows the PATIENT-RESPONSIBILITY
 * balance (not the insurance portion) with the pending-insurance exclusion note — without a live DB.
 * A pageerror listener guards against React swallowing a render exception (project lesson).
 */

const CUSTOMERS = {
  value: [{ Id: 'cust-1', Name: 'Jane Patient', Email: 'jane@example.com' }],
};

// Two invoices: charges 200 & 100; insurance paid 120 & 60; patient responsibility 50 & 30 => balance 80.
// One invoice also has $500 still pending insurance, which must NOT be added to the patient balance.
const STATEMENT = {
  value: [
    {
      CustomerId: 'cust-1', CustomerName: 'Jane Patient', CustomerEmail: 'jane@example.com',
      InvoiceId: 'inv-1', InvoiceNumber: 'INV-1', IssueDate: '2026-05-01', DueDate: '2026-06-01',
      StatementDate: '2026-07-01', InvoiceCharges: 200, InsuranceBilled: 150, InsurancePaid: 120,
      InsuranceAdjustment: 30, InsurancePending: 500, PatientCharge: 50, PatientPaid: 0,
      PatientAdjustment: 0, PatientResponsibility: 50, PatientStatus: 'Open', DaysPastDue: 65, AgingBucket: '61-90',
    },
    {
      CustomerId: 'cust-1', CustomerName: 'Jane Patient', CustomerEmail: 'jane@example.com',
      InvoiceId: 'inv-2', InvoiceNumber: 'INV-2', IssueDate: '2026-07-01', DueDate: '2026-07-15',
      StatementDate: '2026-08-15', InvoiceCharges: 100, InsuranceBilled: 70, InsurancePaid: 60,
      InsuranceAdjustment: 10, InsurancePending: 0, PatientCharge: 30, PatientPaid: 0,
      PatientAdjustment: 0, PatientResponsibility: 30, PatientStatus: 'Open', DaysPastDue: 20, AgingBucket: '1-30',
    },
  ],
};

test('patient statement shows the patient-responsibility balance, not the insurance portion', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  await page.route('**/api/customers**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(CUSTOMERS) }));
  await page.route('**/api/patientstatement**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(STATEMENT) }));
  // Stub the dunning panel's email-api calls so the panel renders cleanly.
  await page.route('**/email-api/patient-statements/overdue**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ patients: [] }) }));
  await page.route('**/email-api/reminders**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ settings: [] }) }));
  await page.route('**/email-api/templates**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ templates: [] }) }));

  await page.goto('/reports/patient-statements');

  await expect(page.getByRole('heading', { name: 'Patient Statements' })).toBeVisible({ timeout: 15000 });

  // Select the patient in the Autocomplete.
  const input = page.getByTestId('patient-select');
  await input.click();
  await input.fill('Jane');
  await page.getByRole('option', { name: 'Jane Patient' }).click();

  // Patient balance due = patient responsibility total (50 + 30 = 80), NOT charges (300) or insurance (180).
  await expect(page.getByTestId('patient-balance-due')).toHaveText('$80.00', { timeout: 15000 });

  // Pending-insurance exclusion note appears ($500 pending, not billed).
  await expect(page.getByText(/still pending insurance and is not included/i)).toBeVisible();

  // Statement lines render with a running balance.
  await expect(page.getByRole('cell', { name: 'INV-1' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'INV-2' })).toBeVisible();

  expect(pageErrors, `page errors: ${pageErrors.join('; ')}`).toHaveLength(0);
});
