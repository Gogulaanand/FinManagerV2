import { describe, expect, it } from 'vitest';

import { parseCsv, previewCsv } from './csv';

describe('bank CSV transformation', () => {
  it('parses quoted commas and escaped quotes', () => {
    expect(parseCsv('Date,Narration\n2026-07-02,"Cafe, ""Downtown"""')).toEqual({
      headers: ['Date', 'Narration'],
      rows: [['2026-07-02', 'Cafe, "Downtown"']],
    });
  });

  it('maps separate withdrawal and deposit columns into positive debit/credit rows', () => {
    const document = parseCsv(
      'Date,Narration,Withdrawal,Deposit\n2026-07-02,UPI food,250,\n2026-07-03,Salary,,50000',
    );
    const preview = previewCsv(
      document,
      {
        bankKey: 'demo',
        columns: {
          Date: 'date',
          Narration: 'description',
          Withdrawal: 'debit',
          Deposit: 'credit',
        },
        defaultCategoryId: null,
      },
      'account-id',
    );
    expect(preview.rows.map((row) => [row.amount, row.direction])).toEqual([
      [250, 'debit'],
      [50000, 'credit'],
    ]);
  });

  it('reports rows without a usable date or amount', () => {
    const preview = previewCsv(
      parseCsv('Date,Narration,Amount\n,Missing date,10\n2026-07-03,Missing amount,'),
      {
        bankKey: 'demo',
        columns: { Date: 'date', Narration: 'description', Amount: 'amount' },
        defaultCategoryId: null,
      },
      'account-id',
    );
    expect(preview.errors).toEqual([
      { sourceRow: 2, message: 'Date is required' },
      { sourceRow: 3, message: 'Amount is required' },
    ]);
  });
});
