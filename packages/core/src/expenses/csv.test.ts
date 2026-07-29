import { describe, expect, it } from 'vitest';

import {
  EXPENSE_TEMPLATE_SAMPLE,
  canonicalImportHash,
  parseCsv,
  previewCsv,
  previewExpenseTemplate,
} from './csv';

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

  it('keeps identical-looking transactions distinct when they occupy different source rows', () => {
    const common = {
      occurredOn: '2026-07-03',
      note: 'UPI food',
      merchant: null,
      amount: 250,
      direction: 'debit' as const,
    };
    expect(canonicalImportHash('account-id', { sourceRow: 2, ...common })).not.toBe(
      canonicalImportHash('account-id', { sourceRow: 3, ...common }),
    );
  });

  it('accepts the strict template and matches categories case-insensitively', () => {
    const preview = previewExpenseTemplate(
      EXPENSE_TEMPLATE_SAMPLE,
      [
        {
          id: '00000000-0000-4000-8000-000000000001',
          name: 'food',
          kind: 'expense',
          icon: null,
          color: null,
          parentId: null,
          isSystem: true,
          sortOrder: 0,
        },
      ],
      '00000000-0000-4000-8000-000000000010',
    );
    expect(preview.errors).toEqual([]);
    expect(preview.rows).toHaveLength(2);
    expect(preview.rows[0]).toMatchObject({
      occurredOn: '2026-01-15',
      categoryId: '00000000-0000-4000-8000-000000000001',
      amount: 850,
      direction: 'debit',
    });
    expect(preview.rows[1]).toMatchObject({ amount: 150000, direction: 'credit' });
    expect(preview.missingCategories).toEqual([{ name: 'Salary', kind: 'income' }]);
  });

  it('rejects random headers and reports malformed rows by source line', () => {
    expect(
      previewExpenseTemplate(
        'Date,Description,Amount\n2026-01-01,Food,10',
        [],
        '00000000-0000-4000-8000-000000000010',
      ),
    ).toMatchObject({
      rows: [],
      errors: [{ sourceRow: 1, message: 'Header must be exactly date,category,amount,type' }],
    });
    const malformed = previewExpenseTemplate(
      'date,category,amount,type\n2026-02-30,Food,10,expense\n2026-01-02,Food,-2,expense\n2026-01-03,Food,20,refund',
      [],
      '00000000-0000-4000-8000-000000000010',
    );
    expect(malformed.rows).toEqual([]);
    expect(malformed.errors.map((error) => error.sourceRow)).toEqual([2, 3, 4]);
  });

  it('sanitizes control characters in category names before matching or creation', () => {
    const preview = previewExpenseTemplate(
      'date,category,amount,type\n2026-01-01,"Food\u0000  ",10,expense',
      [],
      '00000000-0000-4000-8000-000000000010',
    );
    expect(preview.rows[0]?.categoryName).toBe('Food');
    expect(preview.missingCategories).toEqual([{ name: 'Food', kind: 'expense' }]);
  });
});
