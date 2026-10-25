const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const axios = require('axios');

async function testImport() {
    try {
        const form = new FormData();
        form.append('file', fs.createReadStream(path.join(__dirname, '../data/test-qbse-small.csv')));

        // We need a source account ID. Let's fetch one first.
        const accountsRes = await axios.get('http://localhost:5000/api/accounts');
        const account = accountsRes.data.value.find(a => a.Type === 'Asset' || a.Type === 'Bank');

        if (!account) {
            console.error('No bank account found');
            return;
        }

        form.append('sourceAccountId', account.Id);
        form.append('sourceType', 'Bank');
        form.append('sourceName', account.Name);

        console.log('Uploading to http://localhost:7072/api/import-csv...');

        const response = await axios.post('http://localhost:7072/api/import-csv', form, {
            headers: {
                ...form.getHeaders()
            }
        });

        console.log('Response:', JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.error('Error:', error.response ? error.response.data : error.message);
    }
}

testImport();
