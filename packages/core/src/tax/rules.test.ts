/**
 * Rule-set integrity tests.
 *
 * These do not check tax math - compute.test.ts does that. They check that the
 * *data* is well-formed, because a malformed slab table fails silently: an
 * out-of-order or overlapping band just quietly taxes the wrong amount.
 *
 * They also pin the headline statutory values, so that a careless edit to
 * rules.ts has to argue with a test naming its source.
 */
import { describe, expect, it } from 'vitest';

import { AVAILABLE_FYS, DEFAULT_FY, RULES, rulesFor } from './rules.js';

describe('rule set lookup', () => {
  it('resolves the default financial year', () => {
    expect(() => rulesFor(DEFAULT_FY)).not.toThrow();
    expect(AVAILABLE_FYS).toContain(DEFAULT_FY);
  });

  it('throws on an unknown year rather than defaulting to zero tax', () => {
    expect(() => rulesFor('1999-00')).toThrow(/No tax rules for FY/);
  });
});

describe.each(AVAILABLE_FYS)('FY %s slab tables', (fy) => {
  const rules = rulesFor(fy);
  const tables = Object.entries(rules.regimes).flatMap(([regime, r]) =>
    Object.entries(r.slabs).map(([band, slabs]) => [`${regime}/${band}`, slabs] as const),
  );

  it.each(tables)('%s is strictly ascending and open-ended', (_name, slabs) => {
    const bounds = slabs.map((s) => s.upTo);
    // Exactly one open-ended band, and it must be last.
    expect(bounds.filter((b) => b === null)).toHaveLength(1);
    expect(bounds.at(-1)).toBeNull();

    const finite = bounds.slice(0, -1) as number[];
    for (let i = 1; i < finite.length; i++) {
      expect(finite[i]).toBeGreaterThan(finite[i - 1]!);
    }
  });

  it.each(tables)('%s starts at a nil band and has non-decreasing rates', (_name, slabs) => {
    // A progressive scale that dips would be a data entry error.
    expect(slabs[0]!.rate).toBe(0);
    for (let i = 1; i < slabs.length; i++) {
      expect(slabs[i]!.rate).toBeGreaterThanOrEqual(slabs[i - 1]!.rate);
    }
  });

  it('orders surcharge tiers ascending in both threshold and rate', () => {
    for (const regime of Object.values(rules.regimes)) {
      const tiers = regime.surchargeTiers;
      for (let i = 1; i < tiers.length; i++) {
        expect(tiers[i]!.over).toBeGreaterThan(tiers[i - 1]!.over);
        expect(tiers[i]!.rate).toBeGreaterThan(tiers[i - 1]!.rate);
      }
    }
  });
});

describe('FY 2026-27 statutory values', () => {
  const rules = RULES['2026-27']!;

  it('is governed by the Income-tax Act, 2025', () => {
    // FY 2026-27 is the first year after the 1961 Act was repealed on
    // 1 April 2026. If this ever reads "1961" the rule set is mislabelled.
    expect(rules.statute).toBe('Income-tax Act, 2025');
  });

  it('sets the new regime standard deduction to 75,000, not the stale 50,000', () => {
    // Raised by the Finance (No.2) Act 2024. Third-party calculators very
    // commonly still carry 50,000 here; that is a 25,000 error on every
    // salaried result, so it gets its own test.
    expect(rules.regimes.new.standardDeduction).toBe(75_000);
    expect(rules.regimes.old.standardDeduction).toBe(50_000);
  });

  it('sets the s.156 rebate to 60,000 up to 12,00,000 with marginal relief', () => {
    expect(rules.regimes.new.rebate).toEqual({
      maxRebate: 60_000,
      incomeLimit: 1_200_000,
      marginalRelief: true,
    });
    expect(rules.regimes.old.rebate).toEqual({
      maxRebate: 12_500,
      incomeLimit: 500_000,
      marginalRelief: false,
    });
  });

  it('caps new regime surcharge at 25% and lets the old regime reach 37%', () => {
    const maxRate = (tiers: readonly { rate: number }[]) => Math.max(...tiers.map((t) => t.rate));
    expect(maxRate(rules.regimes.new.surchargeTiers)).toBe(0.25);
    expect(maxRate(rules.regimes.old.surchargeTiers)).toBe(0.37);
  });

  it('charges 4% cess in both regimes', () => {
    expect(rules.regimes.new.cessRate).toBe(0.04);
    expect(rules.regimes.old.cessRate).toBe(0.04);
  });

  it('withdraws HRA, Chapter VI-A and professional tax in the new regime', () => {
    expect(rules.regimes.new.allowsHraExemption).toBe(false);
    expect(rules.regimes.new.allowsChapterViA).toBe(false);
    expect(rules.regimes.new.allowsProfessionalTax).toBe(false);

    expect(rules.regimes.old.allowsHraExemption).toBe(true);
    expect(rules.regimes.old.allowsChapterViA).toBe(true);
    expect(rules.regimes.old.allowsProfessionalTax).toBe(true);
  });

  it('raises the employer NPS ceiling to 14% in the new regime', () => {
    expect(rules.regimes.new.employerNpsRate).toBe(0.14);
    expect(rules.regimes.old.employerNpsRate).toBe(0.1);
  });

  it('pins the Chapter VI-A caps', () => {
    expect(rules.caps).toEqual({
      section80C: 150_000,
      section80CCD1B: 50_000,
      section80DSelf: 25_000,
      section80DSelfSenior: 50_000,
      section80DParents: 25_000,
      section80DParentsSenior: 50_000,
      section80DPreventive: 5_000,
      // Article 276(2) of the Constitution caps professional tax nationwide.
      professionalTaxMax: 2_500,
    });
  });
});
