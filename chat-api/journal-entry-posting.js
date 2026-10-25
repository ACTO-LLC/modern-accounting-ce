/**
 * Atomic journal-entry posting helper.
 *
 * TR_JournalEntryLines_EnforceBalance enforces debit=credit on EVERY row operation against
 * JournalEntryLines. Inserting lines one at a time (the old pattern) trips it on the first one-sided
 * line, so no entry could be posted on a database that carries the trigger. This helper routes the
 * whole entry through dbo.sp_PostJournalEntry (exposed as the DAB `postjournalentry` stored-procedure
 * entity), which inserts every line in a single statement — the trigger then evaluates the complete,
 * balanced entry exactly once.
 *
 * All GL posting paths (invoices, bills, voids/reversals, 835 adjudication, PI/WC settlement) go
 * through here.
 */

import dotenv from 'dotenv';
dotenv.config();

import axiosLib from 'axios';
import { randomUUID } from 'crypto';

const DAB_API_URL = process.env.DAB_API_URL || 'http://localhost:5000/api';

// DAB Simulator provider requires X-MS-API-ROLE to resolve permissions.
const axios = axiosLib.create({ headers: { 'X-MS-API-ROLE': 'Admin' } });

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * Create a journal entry and all of its lines atomically.
 *
 * @param {object} entry
 * @param {string} [entry.id]              JE id (generated if omitted).
 * @param {string} entry.transactionDate   ISO date/datetime.
 * @param {string} entry.description
 * @param {string} [entry.status='Posted'] 'Posted' or 'Draft'.
 * @param {string} [entry.createdBy='system']
 * @param {string} [entry.reference]
 * @param {string} [entry.sourceSystem]
 * @param {string} [entry.sourceId]
 * @param {string} [entry.postedBy]
 * @param {Array<{AccountId:string,Description?:string,Debit?:number,Credit?:number,ProjectId?:string,ClassId?:string}>} entry.lines
 * @returns {Promise<string>} the journal entry id.
 */
export async function postBalancedJournalEntry(entry) {
    const {
        id = randomUUID(),
        transactionDate,
        description,
        status = 'Posted',
        createdBy = 'system',
        reference = null,
        sourceSystem = null,
        sourceId = null,
        postedBy = null,
        lines = [],
    } = entry;

    if (!Array.isArray(lines) || lines.length === 0) {
        throw new Error('postBalancedJournalEntry: at least one line is required.');
    }

    // Balance is enforced by TR_JournalEntryLines_EnforceBalance inside the stored procedure's single
    // insert — that DB trigger is the authority (0.0001 tolerance), so no separate check here.
    const linesJson = JSON.stringify(
        lines.map((l) => ({
            AccountId: l.AccountId,
            Description: l.Description ?? null,
            Debit: round2(l.Debit || 0),
            Credit: round2(l.Credit || 0),
            ProjectId: l.ProjectId ?? null,
            ClassId: l.ClassId ?? null,
        })),
    );

    const res = await axios.post(`${DAB_API_URL}/postjournalentry`, {
        Id: id,
        TransactionDate: transactionDate,
        Description: description,
        Status: status,
        CreatedBy: createdBy,
        LinesJson: linesJson,
        Reference: reference,
        SourceSystem: sourceSystem,
        SourceId: sourceId,
        PostedBy: postedBy,
    });

    return res.data?.value?.[0]?.JournalEntryId || id;
}

export default { postBalancedJournalEntry };
