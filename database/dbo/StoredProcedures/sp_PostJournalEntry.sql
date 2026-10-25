-- sp_PostJournalEntry — atomically create a journal entry and ALL of its lines.
--
-- Why this exists: TR_JournalEntryLines_EnforceBalance (migration 026) enforces debit=credit for a
-- journal entry on EVERY row operation against JournalEntryLines. The posting services historically
-- inserted lines one at a time over DAB REST, so the first (one-sided) line insert always tripped the
-- trigger — no journal entry could be posted on a database that carries the trigger. This proc inserts
-- every line in a SINGLE INSERT...SELECT statement, so the AFTER-INSERT trigger fires once and sees the
-- complete, balanced set.
--
-- Lines are passed as a JSON array (DAB stored-procedure entities accept only scalar parameters, so a
-- table-valued parameter is not an option over REST). Shape of each element:
--   { "AccountId": "<guid>", "Description": "...", "Debit": 0, "Credit": 0,
--     "ProjectId": "<guid|null>", "ClassId": "<guid|null>" }
--
-- Runs in a transaction with XACT_ABORT so a trigger THROW rolls back the header too. Returns the
-- journal entry id as a single-row result set (so DAB can surface it).
CREATE PROCEDURE [dbo].[sp_PostJournalEntry]
    @Id UNIQUEIDENTIFIER,
    @TransactionDate DATETIME2,
    @Description NVARCHAR(MAX),
    @Status NVARCHAR(40),
    @CreatedBy NVARCHAR(200),
    @LinesJson NVARCHAR(MAX),
    @Reference NVARCHAR(200) = NULL,
    @SourceSystem NVARCHAR(100) = NULL,
    @SourceId NVARCHAR(200) = NULL,
    @PostedBy NVARCHAR(200) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @LinesJson IS NULL OR ISJSON(@LinesJson) <> 1
        THROW 50700, 'sp_PostJournalEntry: @LinesJson must be a valid JSON array of lines.', 1;

    BEGIN TRANSACTION;

        INSERT INTO [dbo].[JournalEntries]
            ([Id], [TransactionDate], [Description], [Reference], [Status],
             [CreatedBy], [SourceSystem], [SourceId], [PostedAt], [PostedBy])
        VALUES
            (@Id, @TransactionDate, @Description, @Reference, @Status,
             @CreatedBy, @SourceSystem, @SourceId,
             CASE WHEN @Status = 'Posted' THEN SYSDATETIME() ELSE NULL END,
             @PostedBy);

        -- Single multi-row insert: the balance trigger evaluates the whole entry at once.
        INSERT INTO [dbo].[JournalEntryLines]
            ([JournalEntryId], [AccountId], [Description], [Debit], [Credit], [ProjectId], [ClassId])
        SELECT
            @Id, j.[AccountId], j.[Description],
            ISNULL(j.[Debit], 0), ISNULL(j.[Credit], 0),
            j.[ProjectId], j.[ClassId]
        FROM OPENJSON(@LinesJson) WITH (
            [AccountId]   UNIQUEIDENTIFIER '$.AccountId',
            [Description] NVARCHAR(500)    '$.Description',
            [Debit]       DECIMAL(19,4)    '$.Debit',
            [Credit]      DECIMAL(19,4)    '$.Credit',
            [ProjectId]   UNIQUEIDENTIFIER '$.ProjectId',
            [ClassId]     UNIQUEIDENTIFIER '$.ClassId'
        ) j;

    COMMIT TRANSACTION;

    SELECT @Id AS [JournalEntryId];
END
GO
