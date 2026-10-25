const sql = require('mssql');
require('dotenv').config();

async function checkTransactions() {
    try {
        await sql.connect(process.env.DB_CONNECTION_STRING);
        const result = await sql.query`
            SELECT Id, Description, Status, IsPersonal, ApprovedCategory 
            FROM BankTransactions 
            ORDER BY CreatedDate DESC
        `;
        console.log('Transactions:', result.recordset);

        const accounts = await sql.query`SELECT * FROM Accounts`;
        console.log('All Accounts:', accounts.recordset);

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await sql.close();
    }
}

checkTransactions();
