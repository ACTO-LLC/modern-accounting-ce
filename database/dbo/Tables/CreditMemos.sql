CREATE TABLE [dbo].[CreditMemos]
(
    [Id] UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    [CreditMemoNumber] NVARCHAR(50) NOT NULL,
    -- Nullable so an insurance-owned memo (a contractual write-down / denial) is NOT a credit to the
    -- patient: such memos carry PayerId instead of CustomerId. Patient/standard memos still set CustomerId.
    [CustomerId] UNIQUEIDENTIFIER NULL,
    [CreditDate] DATE NOT NULL,
    [Reason] NVARCHAR(500) NULL,
    [Subtotal] DECIMAL(19,4) NOT NULL DEFAULT 0,
    [TaxAmount] DECIMAL(19,4) NOT NULL DEFAULT 0,
    [TotalAmount] DECIMAL(19,4) NOT NULL DEFAULT 0,
    [AmountApplied] DECIMAL(19,4) NOT NULL DEFAULT 0,
    [AmountRefunded] DECIMAL(19,4) NOT NULL DEFAULT 0,
    [Status] NVARCHAR(20) NOT NULL DEFAULT 'Open',
        -- 'ContractualAdjustment' = 835 CAS write-down to a contracted rate; routed to a contra-revenue
    -- (contractual-allowance) account, NOT bad debt.
    [CreditMemoType] NVARCHAR(30) NOT NULL DEFAULT 'Standard',
    -- 835 CAS adjustment group code: CO | PR | OA | PI | CR
    [AdjustmentGroupCode] NVARCHAR(4) NULL,
    -- CARC (+ optional RARC) reason code carried from the remittance
    [AdjustmentReasonCode] NVARCHAR(10) NULL,
    -- The insurance payer the adjustment/write-down originates from
    [PayerId] UNIQUEIDENTIFIER NULL,
    [ProjectId] UNIQUEIDENTIFIER NULL,
    [ClassId] UNIQUEIDENTIFIER NULL,
    [JournalEntryId] UNIQUEIDENTIFIER NULL,
    [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    [UpdatedAt] DATETIME2 NOT NULL DEFAULT SYSDATETIME(),

    [ValidFrom] DATETIME2 GENERATED ALWAYS AS ROW START HIDDEN NOT NULL,
    [ValidTo] DATETIME2 GENERATED ALWAYS AS ROW END HIDDEN NOT NULL,
    PERIOD FOR SYSTEM_TIME ([ValidFrom], [ValidTo]),

    CONSTRAINT [FK_CreditMemos_Customers] FOREIGN KEY ([CustomerId]) REFERENCES [dbo].[Customers]([Id]),
    CONSTRAINT [FK_CreditMemos_JournalEntries] FOREIGN KEY ([JournalEntryId]) REFERENCES [dbo].[JournalEntries]([Id]),
    CONSTRAINT [FK_CreditMemos_Projects] FOREIGN KEY ([ProjectId]) REFERENCES [dbo].[Projects]([Id]),
    CONSTRAINT [FK_CreditMemos_Classes] FOREIGN KEY ([ClassId]) REFERENCES [dbo].[Classes]([Id]),
    CONSTRAINT [CK_CreditMemos_Status] CHECK ([Status] IN ('Open', 'Applied', 'PartiallyApplied', 'Refunded', 'Voided')),
    CONSTRAINT [CK_CreditMemos_Type] CHECK ([CreditMemoType] IN ('Standard', 'ContractualAdjustment', 'Denial', 'Writeoff')),
    -- Every memo belongs to EXACTLY ONE party: a patient/guarantor (CustomerId) or an insurance payer
    -- (PayerId), never both -- otherwise ownership is ambiguous.
    CONSTRAINT [CK_CreditMemos_Party] CHECK (
        ([CustomerId] IS NOT NULL AND [PayerId] IS NULL)
        OR ([CustomerId] IS NULL AND [PayerId] IS NOT NULL)
    ),
    -- Insurance write-downs (contractual adjustments / denials) must be attributed to a payer...
    CONSTRAINT [CK_CreditMemos_AdjustmentPayer] CHECK (
        [CreditMemoType] NOT IN ('ContractualAdjustment', 'Denial') OR [PayerId] IS NOT NULL
    ),
    -- ...and must never be refundable (a contracted write-down is not cash owed back to anyone): neither a
    -- refunded amount nor a Refunded status. Non-transferability (not applying these to unrelated patient
    -- invoices) is enforced in the credit-application writer, which journals by CreditMemoType.
    CONSTRAINT [CK_CreditMemos_NoRefundOnAdjustment] CHECK (
        [CreditMemoType] NOT IN ('ContractualAdjustment', 'Denial')
        OR ([AmountRefunded] = 0 AND [Status] <> 'Refunded')
    )
)
WITH (SYSTEM_VERSIONING = ON (HISTORY_TABLE = [dbo].[CreditMemos_History]))
GO

CREATE INDEX [IX_CreditMemos_CustomerId] ON [dbo].[CreditMemos]([CustomerId])
GO

CREATE INDEX [IX_CreditMemos_Status] ON [dbo].[CreditMemos]([Status])
GO

CREATE INDEX [IX_CreditMemos_CreditDate] ON [dbo].[CreditMemos]([CreditDate])
GO

CREATE UNIQUE INDEX [IX_CreditMemos_CreditMemoNumber] ON [dbo].[CreditMemos]([CreditMemoNumber])
GO

CREATE INDEX [IX_CreditMemos_ProjectId] ON [dbo].[CreditMemos]([ProjectId]) WHERE ProjectId IS NOT NULL
GO

CREATE INDEX [IX_CreditMemos_ClassId] ON [dbo].[CreditMemos]([ClassId]) WHERE ClassId IS NOT NULL
GO

CREATE INDEX [IX_CreditMemos_PayerId] ON [dbo].[CreditMemos]([PayerId]) WHERE PayerId IS NOT NULL
GO

CREATE INDEX [IX_CreditMemos_Type] ON [dbo].[CreditMemos]([CreditMemoType])
GO
