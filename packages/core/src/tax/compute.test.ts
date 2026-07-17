/**
 * Tax engine tests.
 *
 * Every expected number here is hand-computed from the FY 2026-27 statute and
 * written down before the implementation was trusted, not copied out of the
 * engine's own output. A test that only asserts what the code already does is
 * worse than no test: it freezes a bug in place.
 *
 * Working is shown in comments for anything non-obvious, so a future session
 * can re-derive rather than re-trust.
 */
import { describe, expect, it } from 'vitest';

import { computeTax, slabTax, taxOnTaxableIncome } from './compute.js';
import { rulesFor } from './rules.js';

const FY = '2026-27';

/** Total tax before rebate, for terse slab assertions. */
function slabTotal(
  income: number,
  regime: 'old' | 'new',
  band: 'below60' | 'senior' | 'superSenior' = 'below60',
) {
  return taxOnTaxableIncome(income, FY, regime, band).taxBeforeRebate;
}

describe('new regime slabs (s.202)', () => {
  it('charges nothing at or below the 4,00,000 basic exemption', () => {
    expect(slabTotal(0, 'new')).toBe(0);
    expect(slabTotal(400_000, 'new')).toBe(0);
  });

  it('charges 5% only on the amount above 4,00,000', () => {
    // 1 rupee into the 5% band.
    expect(slabTotal(400_001, 'new')).toBe(0.05);
    // 8,00,000: 4L at 5% = 20,000.
    expect(slabTotal(800_000, 'new')).toBe(20_000);
  });

  it('stacks each slab on the one below it', () => {
    // 12L: 20,000 + 4L at 10% (40,000) = 60,000.
    expect(slabTotal(1_200_000, 'new')).toBe(60_000);
    // 16L: 60,000 + 4L at 15% (60,000) = 1,20,000.
    expect(slabTotal(1_600_000, 'new')).toBe(120_000);
    // 20L: 1,20,000 + 4L at 20% (80,000) = 2,00,000.
    expect(slabTotal(2_000_000, 'new')).toBe(200_000);
    // 24L: 2,00,000 + 4L at 25% (1,00,000) = 3,00,000.
    expect(slabTotal(2_400_000, 'new')).toBe(300_000);
    // 30L: 3,00,000 + 6L at 30% (1,80,000) = 4,80,000.
    expect(slabTotal(3_000_000, 'new')).toBe(480_000);
  });

  it('does not vary by age', () => {
    expect(slabTotal(1_600_000, 'new', 'senior')).toBe(120_000);
    expect(slabTotal(1_600_000, 'new', 'superSenior')).toBe(120_000);
  });
});

describe('old regime slabs', () => {
  it('applies the 2,50,000 exemption for under-60s', () => {
    expect(slabTotal(250_000, 'old')).toBe(0);
    // 5L: 2.5L at 5% = 12,500.
    expect(slabTotal(500_000, 'old')).toBe(12_500);
    // 10L: 12,500 + 5L at 20% (1,00,000) = 1,12,500.
    expect(slabTotal(1_000_000, 'old')).toBe(112_500);
    // 15L: 1,12,500 + 5L at 30% (1,50,000) = 2,62,500.
    expect(slabTotal(1_500_000, 'old')).toBe(262_500);
  });

  it('raises the exemption to 3,00,000 for seniors', () => {
    expect(slabTotal(300_000, 'old', 'senior')).toBe(0);
    // 10L: 2L at 5% (10,000) + 5L at 20% (1,00,000) = 1,10,000.
    expect(slabTotal(1_000_000, 'old', 'senior')).toBe(110_000);
  });

  it('raises the exemption to 5,00,000 for super seniors and skips the 5% band', () => {
    expect(slabTotal(500_000, 'old', 'superSenior')).toBe(0);
    // 10L: 5L at 20% = 1,00,000. There is no 5% band at all.
    expect(slabTotal(1_000_000, 'old', 'superSenior')).toBe(100_000);
  });
});

describe('rebate (s.156)', () => {
  it('wipes out the bill exactly at 12,00,000 in the new regime', () => {
    const r = taxOnTaxableIncome(1_200_000, FY, 'new');
    expect(r.taxBeforeRebate).toBe(60_000);
    expect(r.rebate).toBe(60_000);
    expect(r.totalTax).toBe(0);
  });

  it('grants marginal relief just above 12,00,000 rather than a cliff', () => {
    // At 12,00,001 the slab tax is 60,000.15. Without relief that is a
    // 60,000 bill for 1 rupee of extra income. Relief caps tax at the excess.
    const r = taxOnTaxableIncome(1_200_001, FY, 'new');
    expect(r.taxBeforeRebate).toBe(60_000.15);
    expect(r.taxAfterRebate).toBe(1);
    expect(r.totalTax).toBe(1.04); // 1 + 4% cess
  });

  it('holds tax equal to the income above 12L while relief binds', () => {
    // 12,60,000: slab tax 69,000, excess 60,000 -> relief pulls tax to 60,000.
    const r = taxOnTaxableIncome(1_260_000, FY, 'new');
    expect(r.taxBeforeRebate).toBe(69_000);
    expect(r.rebate).toBe(9_000);
    expect(r.taxAfterRebate).toBe(60_000);
  });

  it('stops relieving once slab tax falls below the excess', () => {
    // Relief binds while 60,000 + 0.15x > x, i.e. x < 70,588.24.
    // At x = 71,000 (income 12,71,000) the taxpayer is better off unrelieved.
    const r = taxOnTaxableIncome(1_271_000, FY, 'new');
    expect(r.rebate).toBe(0);
    expect(r.taxAfterRebate).toBe(70_650); // 60,000 + 15% of 71,000
  });

  it('is a hard cliff in the old regime, with no marginal relief', () => {
    const at = taxOnTaxableIncome(500_000, FY, 'old');
    expect(at.rebate).toBe(12_500);
    expect(at.totalTax).toBe(0);

    // One rupee more and the entire 12,500 rebate vanishes. This is the
    // statute, not a bug: the old regime never got marginal relief.
    const over = taxOnTaxableIncome(500_001, FY, 'old');
    expect(over.rebate).toBe(0);
    expect(over.taxAfterRebate).toBe(12_500.2);
  });
});

describe('surcharge and its marginal relief', () => {
  it('levies no surcharge at or below 50,00,000', () => {
    expect(taxOnTaxableIncome(5_000_000, FY, 'new').surchargeRate).toBe(0);
  });

  it('relieves the 50,00,000 threshold so 1L more income cannot cost 1.1L tax', () => {
    // Tax at 50L = 3,00,000 + 30% of 26L = 10,80,000, no surcharge.
    // At 51L raw = 11,10,000 * 1.10 = 12,21,000.
    // Table 2 cap = 10,80,000 + 1,00,000 = 11,80,000.
    const r = taxOnTaxableIncome(5_100_000, FY, 'new');
    expect(r.surchargeRate).toBe(0.1);
    expect(r.taxAfterRebate).toBe(1_110_000);
    expect(r.surchargeMarginalRelief).toBe(41_000);
    expect(r.surcharge).toBe(70_000); // 11,80,000 - 11,10,000
    expect(r.cess).toBe(47_200); // 4% of 11,80,000
    expect(r.totalTax).toBe(1_227_200);
  });

  it('stops relieving once the surcharge is cheaper than the cap', () => {
    // Relief binds up to ~51,61,194. At 52L the raw charge is below the cap.
    const r = taxOnTaxableIncome(5_200_000, FY, 'new');
    expect(r.surchargeMarginalRelief).toBe(0);
    expect(r.surcharge).toBe(114_000); // 10% of 11,40,000
    expect(r.totalTax).toBe(1_304_160);
  });

  it('relieves the 1,00,00,000 threshold using the 10% tier as the baseline', () => {
    // Un at 1cr = 25,80,000 * 1.10 = 28,38,000 (the 10% tier still applies at
    // exactly 1cr, since 15% needs income to *exceed* it). Cap = Un + 1,00,000.
    const r = taxOnTaxableIncome(10_100_000, FY, 'new');
    expect(r.surchargeRate).toBe(0.15);
    expect(r.surchargeMarginalRelief).toBe(63_500);
    expect(r.totalTax).toBe(3_055_520);
  });

  it('caps the new regime at 25% but lets the old regime reach 37%', () => {
    expect(taxOnTaxableIncome(60_000_000, FY, 'new').surchargeRate).toBe(0.25);
    expect(taxOnTaxableIncome(60_000_000, FY, 'old').surchargeRate).toBe(0.37);
  });

  it('charges cess on tax plus surcharge, not on tax alone', () => {
    const r = taxOnTaxableIncome(5_200_000, FY, 'new');
    expect(r.cess).toBe(Math.round((r.taxAfterRebate + r.surcharge) * 0.04 * 100) / 100);
  });
});

describe('zero and extreme incomes', () => {
  it('taxes nothing on zero income', () => {
    const r = taxOnTaxableIncome(0, FY, 'new');
    expect(r.totalTax).toBe(0);
    expect(r.rebate).toBe(0);
  });

  it('treats negative taxable income as zero rather than refunding', () => {
    expect(taxOnTaxableIncome(-500_000, FY, 'new').totalTax).toBe(0);
  });

  it('stays within the roundToPaise safe range at 100 crore', () => {
    // roundToPaise is paise-accurate to ~1,000 crore (D-014). A 100 crore
    // income sits inside that, so the result must still be finite and exact.
    const r = taxOnTaxableIncome(1_000_000_000, FY, 'new');
    expect(Number.isFinite(r.totalTax)).toBe(true);
    expect(r.surchargeRate).toBe(0.25);
    // Slab tax = 3,00,000 + 30% of 99,76,00,000 (29,92,80,000) = 29,95,80,000.
    expect(r.taxBeforeRebate).toBe(299_580_000);
  });
});

describe('slabTax breakdown', () => {
  it('reports the income falling in each band, not just the total', () => {
    const charges = slabTax(1_000_000, rulesFor(FY).regimes.new.slabs.below60);
    expect(charges.map((c) => c.taxableInBand)).toEqual([400_000, 400_000, 200_000]);
    expect(charges.map((c) => c.tax)).toEqual([0, 20_000, 20_000]);
  });

  it('stops at the band containing the income', () => {
    const charges = slabTax(500_000, rulesFor(FY).regimes.new.slabs.below60);
    expect(charges).toHaveLength(2);
  });
});

describe('computeTax end to end', () => {
  const ctc = 2_400_000;

  it('decomposes a 24L CTC and taxes the new regime correctly', () => {
    const r = computeTax({ fy: FY, salary: { ctc } });

    // basic 9,60,000; hra 4,80,000; employer PF 1,15,200; gratuity 46,176;
    // special allowance 7,98,624 -> gross 22,38,624.
    expect(r.salary.basic).toBe(960_000);
    expect(r.salary.gross).toBe(2_238_624);

    // New regime: no HRA, no 80C. Taxable = 22,38,624 - 75,000 = 21,63,624.
    expect(r.new.taxableIncome).toBe(2_163_624);
    // Slab: 20,000 + 40,000 + 60,000 + 80,000 + 25% of 1,63,624 (40,906).
    expect(r.new.taxBeforeRebate).toBe(240_906);
    expect(r.new.rebate).toBe(0);
    expect(r.new.cess).toBe(9_636.24);
    expect(r.new.totalTax).toBe(250_542.24);
    // In-hand = gross - employee PF - professional tax - tax.
    expect(r.new.annualInHand).toBe(1_870_381.76);
    expect(r.new.monthlyInHand).toBe(155_865.15);
  });

  it('applies HRA, 80C and professional tax in the old regime only', () => {
    const r = computeTax({
      fy: FY,
      salary: { ctc },
      deductions: { rentPaid: 300_000, section80C: 150_000 },
    });

    // HRA exempt = least of 4,80,000 / (3,00,000 - 96,000 = 2,04,000) /
    // 50% of basic (4,80,000) = 2,04,000.
    expect(r.old.hraExempt).toBe(204_000);
    // 80C: declared 1,50,000 + employee PF 1,15,200, capped at 1,50,000.
    expect(r.old.chapterViA.section80C).toBe(150_000);
    expect(r.old.professionalTaxDeducted).toBe(2_500);
    // Taxable = 22,38,624 - 2,04,000 - 50,000 - 2,500 - 1,50,000 = 18,32,124.
    expect(r.old.taxableIncome).toBe(1_832_124);
    // Slab: 12,500 + 1,00,000 + 30% of 8,32,124 (2,49,637.20) = 3,62,137.20.
    expect(r.old.taxBeforeRebate).toBe(362_137.2);

    // The new regime ignores all three.
    expect(r.new.hraExempt).toBe(0);
    expect(r.new.chapterViA.total).toBe(0);
    expect(r.new.professionalTaxDeducted).toBe(0);
  });

  it('still subtracts professional tax from take-home in the new regime', () => {
    // PT is a state levy: it leaves the payslip under both regimes. Only its
    // deductibility differs. Take-home must reflect that.
    const r = computeTax({ fy: FY, salary: { ctc } });
    const expected = r.new.gross - r.salary.employeePf - 2_500 - r.new.totalTax;
    expect(r.new.annualInHand).toBe(expected);
  });

  it('names the better regime and the gap between them', () => {
    const r = computeTax({
      fy: FY,
      salary: { ctc },
      deductions: { rentPaid: 300_000, section80C: 150_000 },
    });
    expect(r.better).toBe(r.new.annualInHand >= r.old.annualInHand ? 'new' : 'old');
    expect(r.savings).toBeCloseTo(Math.abs(r.new.annualInHand - r.old.annualInHand), 2);
  });

  it('flips to the old regime when deductions are large enough', () => {
    // A heavily-deducted profile: max 80C, 80CCD(1B), 80D for self and senior
    // parents, and high metro rent. This is the case the new regime loses.
    const heavy = computeTax({
      fy: FY,
      salary: { ctc: 1_500_000 },
      deductions: {
        rentPaid: 360_000,
        section80C: 150_000,
        section80CCD1B: 50_000,
        section80DSelf: 25_000,
        section80DParents: 50_000,
        areParentsSenior: true,
      },
    });
    expect(heavy.better).toBe('old');

    // The same salary with no deductions must favour the new regime.
    const bare = computeTax({ fy: FY, salary: { ctc: 1_500_000 } });
    expect(bare.better).toBe('new');
  });

  it('pays no tax under the new regime at a 12.75L taxable-equivalent salary', () => {
    // The headline "12.75L is tax free" claim: 12,75,000 gross - 75,000
    // standard deduction = 12,00,000 taxable, fully rebated.
    const r = computeTax({
      fy: FY,
      salary: { ctc: 1_275_000, basicRate: 1, hraRate: 0, employerPfRate: 0, gratuityRate: 0 },
    });
    expect(r.new.gross).toBe(1_275_000);
    expect(r.new.taxableIncome).toBe(1_200_000);
    expect(r.new.totalTax).toBe(0);
  });

  it('handles zero CTC without dividing by zero', () => {
    const r = computeTax({ fy: FY, salary: { ctc: 0 } });
    expect(r.new.totalTax).toBe(0);
    expect(r.new.effectiveRate).toBe(0);
    // Professional tax still leaves the payslip even on no salary, so take-home
    // goes mildly negative rather than to zero: 2,500 a year, 208.33 a month.
    expect(r.new.annualInHand).toBe(-2_500);
    expect(r.new.monthlyInHand).toBe(-208.33);
  });

  it('rejects an unknown financial year loudly', () => {
    expect(() => computeTax({ fy: '2019-20', salary: { ctc } })).toThrow(/No tax rules for FY/);
  });
});

describe('employer NPS under 80CCD(2)', () => {
  it('survives in the new regime, capped at 14% of basic', () => {
    const r = computeTax({
      fy: FY,
      salary: { ctc: 2_400_000, employerNpsRate: 0.2 },
    });
    // Employer contributed 20% of basic but only 14% is deductible.
    expect(r.new.chapterViA.employerNps).toBe(960_000 * 0.14);
    expect(r.new.chapterViA.total).toBe(960_000 * 0.14);
  });

  it('is capped at 10% of basic in the old regime for non-government employers', () => {
    const r = computeTax({
      fy: FY,
      salary: { ctc: 2_400_000, employerNpsRate: 0.2 },
    });
    expect(r.old.chapterViA.employerNps).toBe(960_000 * 0.1);
  });
});
