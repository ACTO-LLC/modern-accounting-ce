const sql = require('mssql');
require('dotenv').config();

async function run() {
    try {
        await sql.connect(process.env.DB_CONNECTION_STRING);

        // 1. Add IsPersonal column
        try {
            await sql.query`ALTER TABLE dbo.BankTransactions ADD IsPersonal BIT DEFAULT 0;`;
            console.log('Added IsPersonal column.');
        } catch (e) {
            console.log('IsPersonal column might already exist:', e.message);
        }

        // 2. Update View
        try {
            await sql.query`
                ALTER VIEW dbo.v_BankTransactions AS
                SELECT 
                    Id,
                    SourceType,
                    BankName,
                    SourceAccountId,
                    TransactionDate,
                    PostDate,
                    Amount,
                    Description,
                    Merchant,
                    OriginalCategory,
                    TransactionType,
                    CardNumber,
                    RawCSVLine,
                    SuggestedAccountId,
                    SuggestedCategory,
                    SuggestedMemo,
                    ConfidenceScore,
                    Status,
                    ReviewedBy,
                    ReviewedDate,
                    ApprovedAccountId,
                    ApprovedCategory,
                    ApprovedMemo,
                    JournalEntryId,
                    CreatedDate,
                    IsPersonal
                FROM dbo.BankTransactions;
            `;
            console.log('Updated v_BankTransactions view.');
        } catch (e) {
            console.error('Failed to update view:', e.message);
        }

        // 4. Check/Create Equity Accounts
        const equityAccounts = await sql.query`SELECT * FROM Accounts WHERE Type = 'Equity'`;
        console.log('Existing Equity Accounts:', equityAccounts.recordset);

        const accountsToCreate = [
            { name: 'Owner\'s Draw', code: '3100' },
            { name: 'Owner\'s Contribution', code: '3200' }
        ];

        for (const acc of accountsToCreate) {
            const exists = equityAccounts.recordset.find(a => a.Name === acc.name);
            if (!exists) {
                await sql.query`
                    INSERT INTO Accounts (Id, Code, Name, Type, IsActive, CreatedAt, UpdatedAt)
                    VALUES (NEWID(), ${acc.code}, ${acc.name}, 'Equity', 1, SYSDATETIME(), SYSDATETIME())
                `;
                console.log(`Created account: ${acc.name}`);
            }
        }
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await sql.close();
    }
}

run();
