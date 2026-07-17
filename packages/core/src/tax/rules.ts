/**
 * Indian income tax rule sets, expressed as data.
 *
 * Every number here is a statutory value with a citation. A future financial
 * year is a new entry in `RULES`, never a new branch in the engine (D-001);
 * if you find yourself adding an `if (fy === ...)` to compute.ts, the shape of
 * this file is wrong, not the engine.
 *
 * Sources are recorded per-rule because getting these wrong is silent and
 * expensive: the engine cannot tell a plausible number from a correct one.
 *
 * FY 2026-27 is the first year governed by the Income-tax Act, 2025 (Act 30 of
 * 2025), which repealed the Income-tax Act, 1961 on 1 April 2026. Section
 * numbers therefore differ from the ones most online calculators still quote:
 * the new regime is s.202 (was 115BAC) and the rebate is s.156 (was 87A).
 */

/** The two parallel tax regimes. The new regime is the statutory default. */
export type Regime = 'old' | 'new';

/**
 * Age bands. Only the old regime varies by age; the new regime's basic
 * exemption is flat, which is why `slabs` is keyed by band in both regimes
 * rather than the engine special-casing one of them.
 */
export type AgeBand = 'below60' | 'senior' | 'superSenior';

export interface Slab {
  /** Upper bound of the band in rupees; `null` means "and above". */
  readonly upTo: number | null;
  /** Marginal rate as a ratio: 0.05 is 5%. */
  readonly rate: number;
}

export interface SurchargeTier {
  /** Surcharge applies to total income strictly above this. */
  readonly over: number;
  /** Rate as a ratio: 0.1 is 10%. */
  readonly rate: number;
}

export interface RebateRule {
  /** Maximum rebate in rupees. */
  readonly maxRebate: number;
  /** Rebate applies only when total income does not exceed this. */
  readonly incomeLimit: number;
  /**
   * Whether marginal relief tapers the rebate just above `incomeLimit`.
   * The new regime has it (s.156); the old regime's 12,500 rebate is a cliff.
   */
  readonly marginalRelief: boolean;
}

export interface RegimeRules {
  readonly slabs: Record<AgeBand, readonly Slab[]>;
  /** Standard deduction on salary income. */
  readonly standardDeduction: number;
  readonly rebate: RebateRule;
  /** Ordered low to high. The engine picks the highest tier the income clears. */
  readonly surchargeTiers: readonly SurchargeTier[];
  /** Health and education cess, charged on tax + surcharge. */
  readonly cessRate: number;
  /** Whether Chapter VI-A deductions (80C, 80D, 80CCD(1B)) are available. */
  readonly allowsChapterViA: boolean;
  /** Whether the HRA exemption is available. */
  readonly allowsHraExemption: boolean;
  /** Whether professional tax is deductible from salary. */
  readonly allowsProfessionalTax: boolean;
  /**
   * Employer NPS contribution deductible as a share of basic salary.
   * The new regime raised this to 14% for all employers; the old regime keeps
   * 10% for non-government employers, which is what we model.
   */
  readonly employerNpsRate: number;
}

export interface DeductionCaps {
  /** 80C + 80CCC + 80CCD(1) aggregate (the 80CCE ceiling). */
  readonly section80C: number;
  /** 80CCD(1B) additional NPS, outside the 80CCE ceiling. */
  readonly section80CCD1B: number;
  /** 80D self/spouse/children, and the senior-citizen variant. */
  readonly section80DSelf: number;
  readonly section80DSelfSenior: number;
  /** 80D parents, and the senior-citizen variant. */
  readonly section80DParents: number;
  readonly section80DParentsSenior: number;
  /** Preventive health check-up sub-limit, inside the 80D ceilings. */
  readonly section80DPreventive: number;
  /**
   * Professional tax is a state levy, so the schedule varies. Article 276(2)
   * of the Constitution caps it at 2,500/year nationwide, which is what we
   * validate against; the amount itself is user-supplied.
   */
  readonly professionalTaxMax: number;
}

export interface FinancialYearRules {
  /** e.g. '2026-27'. */
  readonly fy: string;
  /** The statute governing this year's income, for display and provenance. */
  readonly statute: string;
  readonly regimes: Record<Regime, RegimeRules>;
  readonly caps: DeductionCaps;
}

/**
 * Slabs under s.202 (the new regime), unchanged for FY 2026-27.
 *
 * Finance Bill 2026 clause 47 is the only amendment to s.202 and it merely
 * omits a cross-reference to s.144; it does not touch the rates.
 * Source: incometax.gov.in slab tables; Finance Bill 2026 clause 47 and its
 * explanatory memorandum.
 */
const NEW_REGIME_SLABS: readonly Slab[] = [
  { upTo: 400_000, rate: 0 },
  { upTo: 800_000, rate: 0.05 },
  { upTo: 1_200_000, rate: 0.1 },
  { upTo: 1_600_000, rate: 0.15 },
  { upTo: 2_000_000, rate: 0.2 },
  { upTo: 2_400_000, rate: 0.25 },
  { upTo: null, rate: 0.3 },
];

/**
 * Old regime slabs, verbatim from the Finance Bill 2026 First Schedule,
 * Part I-B ("INCOME-TAX UNDER THE INCOME-TAX ACT, 2025"), Paragraph A.
 * Items (I), (II) and (III) are the three age bands.
 */
const OLD_REGIME_SLABS: Record<AgeBand, readonly Slab[]> = {
  below60: [
    { upTo: 250_000, rate: 0 },
    { upTo: 500_000, rate: 0.05 },
    { upTo: 1_000_000, rate: 0.2 },
    { upTo: null, rate: 0.3 },
  ],
  senior: [
    { upTo: 300_000, rate: 0 },
    { upTo: 500_000, rate: 0.05 },
    { upTo: 1_000_000, rate: 0.2 },
    { upTo: null, rate: 0.3 },
  ],
  superSenior: [
    { upTo: 500_000, rate: 0 },
    { upTo: 1_000_000, rate: 0.2 },
    { upTo: null, rate: 0.3 },
  ],
};

/**
 * Surcharge tiers, from the Finance Bill 2026 First Schedule, Part I-B,
 * Paragraph F, Table 1, Sl. No. 1.
 *
 * The 37% top tier exists only in the old regime; the new regime is capped at
 * 25%. Note that Table 1 items (iii) and (iv) exclude dividend and capital
 * gains income from the 25%/37% tiers, and item (vi) caps surcharge on that
 * income at 15%. We model salary only, so those carve-outs do not apply yet -
 * they must be revisited when capital gains land (Phase 5).
 */
const OLD_REGIME_SURCHARGE: readonly SurchargeTier[] = [
  { over: 5_000_000, rate: 0.1 },
  { over: 10_000_000, rate: 0.15 },
  { over: 20_000_000, rate: 0.25 },
  { over: 50_000_000, rate: 0.37 },
];

const NEW_REGIME_SURCHARGE: readonly SurchargeTier[] = [
  { over: 5_000_000, rate: 0.1 },
  { over: 10_000_000, rate: 0.15 },
  { over: 20_000_000, rate: 0.25 },
];

const FY_2026_27: FinancialYearRules = {
  fy: '2026-27',
  statute: 'Income-tax Act, 2025',
  regimes: {
    new: {
      slabs: {
        below60: NEW_REGIME_SLABS,
        senior: NEW_REGIME_SLABS,
        superSenior: NEW_REGIME_SLABS,
      },
      // Raised from 50,000 by the Finance (No.2) Act 2024 proviso to s.16(ia),
      // carried into the 2025 Act. This is the single most commonly stale
      // number in third-party calculators.
      standardDeduction: 75_000,
      // s.156 (was 87A). 60,000 up to 12L, with marginal relief above it.
      rebate: { maxRebate: 60_000, incomeLimit: 1_200_000, marginalRelief: true },
      surchargeTiers: NEW_REGIME_SURCHARGE,
      cessRate: 0.04,
      allowsChapterViA: false,
      allowsHraExemption: false,
      allowsProfessionalTax: false,
      employerNpsRate: 0.14,
    },
    old: {
      slabs: OLD_REGIME_SLABS,
      standardDeduction: 50_000,
      // The old regime's rebate is a hard cliff: at 5,00,001 it vanishes
      // entirely. That is the statute, not an oversight.
      rebate: { maxRebate: 12_500, incomeLimit: 500_000, marginalRelief: false },
      surchargeTiers: OLD_REGIME_SURCHARGE,
      cessRate: 0.04,
      allowsChapterViA: true,
      allowsHraExemption: true,
      allowsProfessionalTax: true,
      employerNpsRate: 0.1,
    },
  },
  caps: {
    section80C: 150_000,
    section80CCD1B: 50_000,
    section80DSelf: 25_000,
    section80DSelfSenior: 50_000,
    section80DParents: 25_000,
    section80DParentsSenior: 50_000,
    section80DPreventive: 5_000,
    professionalTaxMax: 2_500,
  },
};

/** Every rule set we know, keyed by financial year. */
export const RULES: Readonly<Record<string, FinancialYearRules>> = {
  '2026-27': FY_2026_27,
};

/** The financial year the app defaults to. */
export const DEFAULT_FY = '2026-27';

/** Financial years available, newest first. */
export const AVAILABLE_FYS: readonly string[] = Object.keys(RULES).sort().reverse();

/** Looks up a rule set, failing loudly rather than silently taxing at zero. */
export function rulesFor(fy: string): FinancialYearRules {
  const rules = RULES[fy];
  if (!rules) {
    throw new RangeError(`No tax rules for FY ${fy}. Known: ${AVAILABLE_FYS.join(', ')}`);
  }
  return rules;
}
