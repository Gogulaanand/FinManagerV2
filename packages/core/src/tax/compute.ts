/**
 * The tax engine.
 *
 * Reads rules.ts as data and applies them. There is deliberately no financial
 * year mentioned anywhere in this file: a new year is a new rule set, not a
 * new branch (D-001).
 *
 * Statutory order of operations, which the tests pin:
 *   gross -> deductions -> taxable income -> slab tax -> rebate ->
 *   surcharge -> surcharge marginal relief -> cess -> total.
 * Rebate before surcharge matters: surcharge is levied on the income-tax
 * actually chargeable, which is the post-rebate figure.
 */
import { roundToPaise } from '../money.js';
import type { AgeBand, FinancialYearRules, Regime, RegimeRules, Slab } from './rules.js';
import { rulesFor } from './rules.js';
import type { CityClass, SalaryStructure, SalaryStructureInput } from './salary.js';
import { decomposeSalary, hraExemption } from './salary.js';

export interface DeductionsInput {
  /** 80C investments the user declares. Employee PF is added automatically. */
  readonly section80C?: number;
  /** 80CCD(1B) additional NPS, outside the 80C ceiling. */
  readonly section80CCD1B?: number;
  /** 80D premium for self, spouse and children. */
  readonly section80DSelf?: number;
  /** 80D premium for parents. */
  readonly section80DParents?: number;
  /** Preventive health check-up spend, capped inside the 80D ceilings. */
  readonly section80DPreventive?: number;
  readonly isSelfSenior?: boolean;
  readonly areParentsSenior?: boolean;
  /** Annual rent paid, for the HRA exemption. */
  readonly rentPaid?: number;
  /**
   * Annual professional tax. A state levy, so it is user-supplied; defaults to
   * the Article 276(2) ceiling, which is what most metro employers deduct.
   */
  readonly professionalTax?: number;
}

export interface TaxInput {
  readonly fy: string;
  readonly ageBand?: AgeBand;
  readonly salary: SalaryStructureInput;
  readonly deductions?: DeductionsInput;
}

/** One slab's contribution to the bill, for showing the working in the UI. */
export interface SlabCharge {
  readonly from: number;
  readonly to: number | null;
  readonly rate: number;
  /** Income actually falling in this band. */
  readonly taxableInBand: number;
  readonly tax: number;
}

export interface ChapterViABreakdown {
  readonly section80C: number;
  readonly section80CCD1B: number;
  readonly section80D: number;
  readonly employerNps: number;
  readonly total: number;
}

export interface RegimeResult {
  readonly regime: Regime;
  readonly gross: number;
  readonly standardDeduction: number;
  readonly hraExempt: number;
  readonly professionalTaxDeducted: number;
  readonly chapterViA: ChapterViABreakdown;
  readonly taxableIncome: number;
  readonly slabBreakdown: readonly SlabCharge[];
  readonly taxBeforeRebate: number;
  readonly rebate: number;
  readonly taxAfterRebate: number;
  readonly surchargeRate: number;
  readonly surcharge: number;
  /** Relief actually granted at a surcharge threshold; zero when not binding. */
  readonly surchargeMarginalRelief: number;
  readonly cess: number;
  readonly totalTax: number;
  /** Total tax as a share of gross salary. Zero gross yields zero, not NaN. */
  readonly effectiveRate: number;
  readonly annualInHand: number;
  readonly monthlyInHand: number;
}

export interface TaxComparison {
  readonly fy: string;
  readonly statute: string;
  readonly salary: SalaryStructure;
  readonly old: RegimeResult;
  readonly new: RegimeResult;
  /** The regime with the higher take-home. Ties resolve to `new`, the default. */
  readonly better: Regime;
  /** Annual rupees saved by taking `better` over the other regime. */
  readonly savings: number;
}

/** Tax on an income against a slab table. Exported for threshold testing. */
export function slabTax(taxableIncome: number, slabs: readonly Slab[]): SlabCharge[] {
  const charges: SlabCharge[] = [];
  let lower = 0;

  for (const slab of slabs) {
    const upper = slab.upTo ?? Infinity;
    const inBand = Math.max(0, Math.min(taxableIncome, upper) - lower);
    charges.push({
      from: lower,
      to: slab.upTo,
      rate: slab.rate,
      taxableInBand: roundToPaise(inBand),
      tax: roundToPaise(inBand * slab.rate),
    });
    if (taxableIncome <= upper) break;
    lower = upper;
  }

  return charges;
}

function totalOf(charges: readonly SlabCharge[]): number {
  return roundToPaise(charges.reduce((sum, c) => sum + c.tax, 0));
}

/** The surcharge rate for an income: the highest tier it strictly exceeds. */
function surchargeRateFor(income: number, rules: RegimeRules): number {
  let rate = 0;
  for (const tier of rules.surchargeTiers) {
    if (income > tier.over) rate = tier.rate;
  }
  return rate;
}

/** Rebate under s.156, with marginal relief where the regime grants it. */
function rebateFor(taxableIncome: number, tax: number, rules: RegimeRules): number {
  const { maxRebate, incomeLimit, marginalRelief } = rules.rebate;

  if (taxableIncome <= incomeLimit) return roundToPaise(Math.min(tax, maxRebate));
  if (!marginalRelief) return 0;

  // Above the limit the rebate tapers so that tax never exceeds the income
  // earned beyond the limit. This is what stops 12,00,001 costing 60,000.
  const excess = taxableIncome - incomeLimit;
  return roundToPaise(Math.max(0, tax - excess));
}

/** Income tax plus surcharge, before marginal relief and cess. */
function taxAndSurchargeRaw(taxableIncome: number, rules: RegimeRules, band: AgeBand): number {
  const tax = totalOf(slabTax(taxableIncome, rules.slabs[band]));
  const afterRebate = roundToPaise(tax - rebateFor(taxableIncome, tax, rules));
  return roundToPaise(afterRebate * (1 + surchargeRateFor(taxableIncome, rules)));
}

/**
 * Surcharge marginal relief, per the Finance Bill 2026 First Schedule,
 * Part I-B, Table 2: `Wn = Un + Vn`, where `Un` is tax+surcharge at the
 * threshold and `Vn` is the income above it.
 *
 * Applied at every threshold the income clears, taking the lowest cap. Only
 * the nearest threshold can actually bind, but testing every one is cheap and
 * removes a class of off-by-one bug at the tier boundaries.
 */
function applySurchargeMarginalRelief(
  taxableIncome: number,
  raw: number,
  rules: RegimeRules,
  band: AgeBand,
): number {
  let capped = raw;
  for (const tier of rules.surchargeTiers) {
    if (taxableIncome <= tier.over) continue;
    const atThreshold = taxAndSurchargeRaw(tier.over, rules, band);
    const cap = roundToPaise(atThreshold + (taxableIncome - tier.over));
    capped = Math.min(capped, cap);
  }
  return roundToPaise(capped);
}

function computeChapterViA(
  deductions: DeductionsInput,
  salary: SalaryStructure,
  rules: RegimeRules,
  caps: FinancialYearRules['caps'],
): ChapterViABreakdown {
  // Employer NPS under 80CCD(2) survives in both regimes - it is the one
  // Chapter VI-A deduction the new regime keeps.
  const employerNps = roundToPaise(
    Math.min(salary.employerNps, salary.basic * rules.employerNpsRate),
  );

  if (!rules.allowsChapterViA) {
    return {
      section80C: 0,
      section80CCD1B: 0,
      section80D: 0,
      employerNps,
      total: employerNps,
    };
  }

  // Employee PF is an 80C investment whether or not the user thinks to declare
  // it, and for most salaried people it alone fills a large part of the cap.
  const declared80C = (deductions.section80C ?? 0) + salary.employeePf;
  const section80C = roundToPaise(Math.min(declared80C, caps.section80C));
  const section80CCD1B = roundToPaise(
    Math.min(deductions.section80CCD1B ?? 0, caps.section80CCD1B),
  );

  const selfCap = deductions.isSelfSenior ? caps.section80DSelfSenior : caps.section80DSelf;
  const parentsCap = deductions.areParentsSenior
    ? caps.section80DParentsSenior
    : caps.section80DParents;
  const preventive = Math.min(deductions.section80DPreventive ?? 0, caps.section80DPreventive);
  // Preventive spend sits inside the self ceiling rather than extending it.
  const section80D = roundToPaise(
    Math.min((deductions.section80DSelf ?? 0) + preventive, selfCap) +
      Math.min(deductions.section80DParents ?? 0, parentsCap),
  );

  const total = roundToPaise(section80C + section80CCD1B + section80D + employerNps);
  return { section80C, section80CCD1B, section80D, employerNps, total };
}

/** The charge on a taxable income: slabs, rebate, surcharge, relief, cess. */
export interface TaxCharge {
  readonly slabBreakdown: readonly SlabCharge[];
  readonly taxBeforeRebate: number;
  readonly rebate: number;
  readonly taxAfterRebate: number;
  readonly surchargeRate: number;
  readonly surcharge: number;
  readonly surchargeMarginalRelief: number;
  readonly cess: number;
  readonly totalTax: number;
}

/**
 * Applies the statutory charge to an already-computed taxable income.
 *
 * Separated from the salary pipeline so slab edges, surcharge thresholds and
 * marginal relief can be tested at exact rupee values, rather than by
 * reverse-engineering a CTC that happens to land on one.
 */
export function taxOnTaxableIncome(
  taxableIncome: number,
  fy: string,
  regime: Regime,
  ageBand: AgeBand = 'below60',
): TaxCharge {
  const rules = rulesFor(fy).regimes[regime];
  const income = Math.max(0, taxableIncome);

  const slabBreakdown = slabTax(income, rules.slabs[ageBand]);
  const taxBeforeRebate = totalOf(slabBreakdown);
  const rebate = rebateFor(income, taxBeforeRebate, rules);
  const taxAfterRebate = roundToPaise(taxBeforeRebate - rebate);

  const surchargeRate = surchargeRateFor(income, rules);
  const raw = roundToPaise(taxAfterRebate * (1 + surchargeRate));
  const relieved = applySurchargeMarginalRelief(income, raw, rules, ageBand);

  const cess = roundToPaise(relieved * rules.cessRate);

  return {
    slabBreakdown,
    taxBeforeRebate,
    rebate,
    taxAfterRebate,
    surchargeRate,
    surcharge: roundToPaise(relieved - taxAfterRebate),
    surchargeMarginalRelief: roundToPaise(raw - relieved),
    cess,
    totalTax: roundToPaise(relieved + cess),
  };
}

function computeRegime(
  regime: Regime,
  salary: SalaryStructure,
  deductions: DeductionsInput,
  fyRules: FinancialYearRules,
  band: AgeBand,
): RegimeResult {
  const rules = fyRules.regimes[regime];

  const professionalTax = Math.min(
    deductions.professionalTax ?? fyRules.caps.professionalTaxMax,
    fyRules.caps.professionalTaxMax,
  );
  const professionalTaxDeducted = rules.allowsProfessionalTax ? professionalTax : 0;

  const hraExempt = rules.allowsHraExemption
    ? hraExemption({
        hraReceived: salary.hra,
        basic: salary.basic,
        rentPaid: deductions.rentPaid ?? 0,
        cityClass: salary.cityClass,
      }).exempt
    : 0;

  // The standard deduction cannot exceed salary itself, which matters only at
  // the very bottom of the range but is what the statute says.
  const standardDeduction = roundToPaise(Math.min(rules.standardDeduction, salary.gross));
  const chapterViA = computeChapterViA(deductions, salary, rules, fyRules.caps);

  const taxableIncome = roundToPaise(
    Math.max(
      0,
      salary.gross - hraExempt - standardDeduction - professionalTaxDeducted - chapterViA.total,
    ),
  );

  const charge = taxOnTaxableIncome(taxableIncome, fyRules.fy, regime, band);

  // Professional tax leaves the payslip under both regimes; the regimes differ
  // only on whether it is deductible. Subtracting the *deducted* figure here
  // would silently hand the new regime a few hundred rupees it never sees.
  const annualInHand = roundToPaise(
    salary.gross - salary.employeePf - professionalTax - charge.totalTax,
  );

  return {
    regime,
    gross: salary.gross,
    standardDeduction,
    hraExempt,
    professionalTaxDeducted,
    chapterViA,
    taxableIncome,
    ...charge,
    effectiveRate: salary.gross > 0 ? charge.totalTax / salary.gross : 0,
    annualInHand,
    monthlyInHand: roundToPaise(annualInHand / 12),
  };
}

/** Computes both regimes and names the better one. */
export function computeTax(input: TaxInput): TaxComparison {
  const fyRules = rulesFor(input.fy);
  const band = input.ageBand ?? 'below60';
  const deductions = input.deductions ?? {};
  const salary = decomposeSalary(input.salary);

  const oldResult = computeRegime('old', salary, deductions, fyRules, band);
  const newResult = computeRegime('new', salary, deductions, fyRules, band);

  const better = oldResult.annualInHand > newResult.annualInHand ? 'old' : 'new';
  const savings = roundToPaise(Math.abs(oldResult.annualInHand - newResult.annualInHand));

  return {
    fy: fyRules.fy,
    statute: fyRules.statute,
    salary,
    old: oldResult,
    new: newResult,
    better,
    savings,
  };
}

export type { AgeBand, CityClass, Regime };
