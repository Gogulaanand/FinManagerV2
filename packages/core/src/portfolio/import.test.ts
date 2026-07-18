import { describe, expect, it } from 'vitest';

import { canonicalPortfolioImportHash, parsePortfolioCsv } from './import';

const zerodha = `trade_date,symbol,isin,trade_type,quantity,price,trade_value,trade_id\n2026-07-17,RELIANCE,INE002A01018,buy,2,1450,2900,T123`;
const cams = `Date,Scheme Name,Folio No,Transaction Type,Units,NAV,Amount\n17/07/2026,HDFC Index Fund,12345,Purchase,10,285,2850`;
const kfintech = `Transaction Date,Scheme,Account Number,Transaction,Units,Price,Amount\n17-07-2026,PPFAS Flexi Cap,ABC123,Redemption,5,100,500`;

describe('parsePortfolioCsv', () => {
  it('parses a Zerodha tradebook into a negative buy event', () => {
    const preview = parsePortfolioCsv('zerodha', zerodha, null);

    expect(preview.errors).toEqual([]);
    expect(preview.rows[0]).toMatchObject({
      name: 'RELIANCE',
      identifier: 'INE002A01018',
      type: 'stock',
      kind: 'buy',
      amount: -2900,
      occurredOn: '2026-07-17',
    });
  });

  it('parses CAMS and KFintech mutual-fund exports', () => {
    expect(parsePortfolioCsv('cams', cams, null).rows[0]).toMatchObject({
      name: 'HDFC Index Fund',
      type: 'mutual_fund',
      kind: 'buy',
      amount: -2850,
    });
    expect(parsePortfolioCsv('kfintech', kfintech, null).rows[0]).toMatchObject({
      name: 'PPFAS Flexi Cap',
      type: 'mutual_fund',
      kind: 'sell',
      amount: 500,
    });
  });

  it('returns an explicit unsupported-format error', () => {
    const preview = parsePortfolioCsv('cams', 'wrong,headers\n1,2', null);
    expect(preview.rows).toEqual([]);
    expect(preview.errors[0]?.message).toContain('headers');
  });
});

describe('canonicalPortfolioImportHash', () => {
  it('does not depend on source row position', () => {
    const row = parsePortfolioCsv('zerodha', zerodha, null).rows[0]!;
    expect(canonicalPortfolioImportHash(row)).toBe(
      canonicalPortfolioImportHash({ ...row, sourceRow: 99 }),
    );
  });
});
