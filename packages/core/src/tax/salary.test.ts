/**
 * Salary decomposition tests.
 *
 * These ratios are house convention, not statute (CTC has no legal
 * definition), so the tests pin the arithmetic and the invariants rather than
 * citing an Act. The HRA exemption is the exception: Rule 2A is statutory.
 */
import { describe, expect, it } from 'vitest';

import { decomposeSalary, hraExemption } from './salary.js';

describe('decomposeSalary', () => {
  it('splits a 24L CTC on the documented defaults', () => {
    const s = decomposeSalary({ ctc: 2_400_000 });
    expect(s.basic).toBe(960_000); // 40% of CTC
    expect(s.hra).toBe(480_000); // 50% of basic (metro)
    expect(s.employerPf).toBe(115_200); // 12% of basic
    expect(s.gratuity).toBe(46_176); // 4.81% of basic
    expect(s.specialAllowance).toBe(798_624); // the balance
    expect(s.employeePf).toBe(115_200); // mirrors the employer rate
  });

  it('always re-sums the components back to exactly the CTC', () => {
    // specialAllowance is the balancing figure, so this must hold for any CTC,
    // including ones where the component ratios produce ugly fractions.
    for (const ctc of [0, 1, 350_000, 1_234_567, 9_999_999.99, 100_000_000]) {
      const s = decomposeSalary({ ctc });
      const sum = s.basic + s.hra + s.specialAllowance + s.employerPf + s.employerNps + s.gratuity;
      expect(sum).toBeCloseTo(ctc, 2);
    }
  });

  it('excludes employer contributions from gross', () => {
    // Employer PF, NPS and gratuity never reach the payslip.
    const s = decomposeSalary({ ctc: 2_400_000, employerNpsRate: 0.1 });
    expect(s.gross).toBe(s.basic + s.hra + s.specialAllowance);
    expect(s.gross).toBeLessThan(s.ctc);
  });

  it('drops HRA to a 40% ceiling outside metros', () => {
    const metro = decomposeSalary({ ctc: 2_400_000, cityClass: 'metro' });
    const other = decomposeSalary({ ctc: 2_400_000, cityClass: 'nonMetro' });
    expect(metro.hra).toBe(480_000);
    expect(other.hra).toBe(384_000); // 40% of basic
  });

  it('clamps special allowance at zero rather than going negative', () => {
    // Ratios that over-allocate the CTC must not silently inflate gross.
    const s = decomposeSalary({ ctc: 1_000_000, basicRate: 0.9, hraRate: 0.9 });
    expect(s.specialAllowance).toBe(0);
  });

  it('rejects a negative or non-finite CTC', () => {
    expect(() => decomposeSalary({ ctc: -1 })).toThrow(RangeError);
    expect(() => decomposeSalary({ ctc: Number.NaN })).toThrow(RangeError);
  });
});

describe('hraExemption (Rule 2A)', () => {
  const basic = 960_000;

  it('takes the least of the three statutory legs', () => {
    // received 4,80,000 | rent - 10% basic = 2,04,000 | 50% basic = 4,80,000
    const e = hraExemption({ hraReceived: 480_000, basic, rentPaid: 300_000, cityClass: 'metro' });
    expect(e.received).toBe(480_000);
    expect(e.rentOverTenPercent).toBe(204_000);
    expect(e.shareOfBasic).toBe(480_000);
    expect(e.exempt).toBe(204_000);
  });

  it('exempts nothing when no rent is paid', () => {
    const e = hraExemption({ hraReceived: 480_000, basic, rentPaid: 0, cityClass: 'metro' });
    expect(e.exempt).toBe(0);
  });

  it('exempts nothing when rent is below 10% of basic', () => {
    // The rent leg would be negative; flooring it at zero is what makes this
    // exempt nothing rather than exempting a negative amount.
    const e = hraExemption({ hraReceived: 480_000, basic, rentPaid: 50_000, cityClass: 'metro' });
    expect(e.rentOverTenPercent).toBe(0);
    expect(e.exempt).toBe(0);
  });

  it('uses a 40% ceiling outside metros', () => {
    // High rent makes the city ceiling the binding leg.
    const metro = hraExemption({
      hraReceived: 600_000,
      basic,
      rentPaid: 900_000,
      cityClass: 'metro',
    });
    const other = hraExemption({
      hraReceived: 600_000,
      basic,
      rentPaid: 900_000,
      cityClass: 'nonMetro',
    });
    expect(metro.exempt).toBe(480_000); // 50% of basic
    expect(other.exempt).toBe(384_000); // 40% of basic
  });

  it('caps the exemption at the HRA actually received', () => {
    const e = hraExemption({ hraReceived: 100_000, basic, rentPaid: 900_000, cityClass: 'metro' });
    expect(e.exempt).toBe(100_000);
  });
});
