// Master data mirroring database/Script.PostDeployment.sql, for tests and --dry-run without a database.

const acct = (Code, Name, Type) => ({ Id: `ACCT-${Code}`, Code, Name, Type });

export const accounts = [
    acct('1000', 'Checking Account', 'Asset'),
    acct('1100', 'Accounts Receivable', 'Asset'),
    acct('2000', 'Accounts Payable', 'Liability'),
    acct('2300', 'Sales Tax Payable', 'Liability'),
    acct('3000', "Owner's Equity", 'Equity'),
    acct('4000', 'Sales Revenue', 'Revenue'),
    acct('4100', 'Service Revenue', 'Revenue'),
    acct('4200', 'Consulting Revenue', 'Revenue'),
    acct('5000', 'Cost of Goods Sold', 'Expense'),
    acct('5100', 'Subcontractor Expense', 'Expense'),
    acct('6300', 'Office Supplies', 'Expense'),
    acct('6400', 'Professional Services', 'Expense'),
    acct('6500', 'Rent Expense', 'Expense'),
    acct('6600', 'Software & Subscriptions', 'Expense'),
    acct('6900', 'Utilities', 'Expense'),
];

export const customers = [
    'Acme Corporation',
    'TechStart Inc.',
    'Global Dynamics',
    'Smith & Associates',
    'Riverside Manufacturing',
    'Creative Solutions LLC',
    'Healthcare Partners',
    'Summit Consulting Group',
].map((Name, i) => ({ Id: `CUST-${i + 1}`, Name }));

const vendor = (i, Name, PaymentTerms, code) => ({
    Id: `VEND-${i}`,
    Name,
    PaymentTerms,
    DefaultExpenseAccountId: `ACCT-${code}`,
});

export const vendors = [
    vendor(1, 'Office Depot', 'Net 30', '6300'),
    vendor(2, 'Amazon Web Services', 'Net 30', '6600'),
    vendor(3, 'Microsoft Corporation', 'Net 30', '6600'),
    vendor(4, 'Johnson & Johnson CPA', 'Net 15', '6400'),
    vendor(5, 'Premier Property Management', 'Due on Receipt', '6500'),
    vendor(6, 'City Power & Light', 'Net 21', '6900'),
    vendor(7, 'Freelance Developer - John Smith', 'Net 15', '5100'),
    vendor(8, 'Design Studio Pro', 'Net 30', '5100'),
];

const product = (i, Name, Type, SalesPrice, code, Description = Name) => ({
    Id: `PROD-${i}`,
    Name,
    Type,
    Description,
    SalesPrice,
    IncomeAccountId: `ACCT-${code}`,
});

export const products = [
    product(1, 'Consulting - Hourly', 'Service', 150, '4200', 'Professional consulting services billed hourly'),
    product(2, 'Software Development - Hourly', 'Service', 175, '4100', 'Custom software development services'),
    product(3, 'Project Management', 'Service', 125, '4100', 'Project management and coordination'),
    product(4, 'Training Session', 'Service', 1500, '4100', 'On-site or virtual training session (full day)'),
    product(5, 'Technical Support - Monthly', 'Service', 500, '4100', 'Monthly technical support package'),
    product(6, 'Software License - Basic', 'NonInventory', 299, '4000'),
    product(7, 'Software License - Professional', 'NonInventory', 999, '4000'),
    product(8, 'Software License - Enterprise', 'NonInventory', 4999, '4000'),
    product(9, 'Branded USB Drive 16GB', 'Inventory', 15, '4000'),
];

export const masterData = { accounts, customers, vendors, products };
