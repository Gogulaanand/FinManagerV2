/**
 * Salary decomposition: CTC in, component-level breakdown out.
 *
 * CTC is not a statutory concept - it is whatever an employer says it is - so
 * the split below is a convention, not a rule. That is exactly why the ratios
 * are inputs with documented defaults rather than constants: Easy mode takes
 * the defaults, Advanced mode overrides every one of them.
 *
 * Kept separate from compute.ts because the statutory tax math is fixed and
 * testable against the Act, whereas these ratios are house style.
 */
import { roundToPaise } from '../money.js';

/** Metro cities attract a 50% HRA ceiling; everywhere else 40% (Rule 2A). */
export type CityClass = 'metro' | 'nonMetro';

export interface SalaryStructureInput {
  /** Annual cost to company, in rupees. */
  readonly ctc: number;
  /** Basic pay as a share of CTC. 40% is the common Indian default. */
  readonly basicRate?: number;
  /** HRA as a share of basic. Employers typically set 50% metro, 40% otherwise. */
  readonly hraRate?: number;
  /** Employer PF as a share of basic. Statutory rate is 12%. */
  readonly employerPfRate?: number;
  /** Employer NPS as a share of basic. Zero unless the employer offers it. */
  readonly employerNpsRate?: number;
  /**
   * Gratuity accrual as a share of basic. 4.81% is the standard actuarial
   * approximation of 15/26 days per year over a year.
   */
  readonly gratuityRate?: number;
  readonly cityClass?: CityClass;
}

export interface SalaryStructure {
  readonly ctc: number;
  readonly basic: number;
  readonly hra: number;
  /** The balancing figure: whatever CTC is left after the named components. */
  readonly specialAllowance: number;
  readonly employerPf: number;
  readonly employerNps: number;
  readonly gratuity: number;
  /**
   * Gross salary: CTC less the employer's own contributions, which never
   * reach the employee's payslip.
   */
  readonly gross: number;
  /** Employee PF, mirrored from the employer rate. Reduces take-home. */
  readonly employeePf: number;
  readonly cityClass: CityClass;
}

export const SALARY_DEFAULTS = {
  basicRate: 0.4,
  hraRateMetro: 0.5,
  hraRateNonMetro: 0.4,
  employerPfRate: 0.12,
  employerNpsRate: 0,
  gratuityRate: 0.0481,
  cityClass: 'metro' as CityClass,
} as const;

/**
 * Decomposes a CTC into components.
 *
 * `specialAllowance` absorbs the rounding of every other component, so the
 * parts always re-sum to exactly the CTC. It can legitimately be driven to
 * zero by aggressive ratios; it is clamped there rather than going negative,
 * which would silently inflate gross.
 */
export function decomposeSalary(input: SalaryStructureInput): SalaryStructure {
  if (!Number.isFinite(input.ctc) || input.ctc < 0) {
    throw new RangeError(`ctc must be a non-negative finite number, received ${input.ctc}`);
  }

  const cityClass = input.cityClass ?? SALARY_DEFAULTS.cityClass;
  const basicRate = input.basicRate ?? SALARY_DEFAULTS.basicRate;
  const hraRate =
    input.hraRate ??
    (cityClass === 'metro' ? SALARY_DEFAULTS.hraRateMetro : SALARY_DEFAULTS.hraRateNonMetro);
  const employerPfRate = input.employerPfRate ?? SALARY_DEFAULTS.employerPfRate;
  const employerNpsRate = input.employerNpsRate ?? SALARY_DEFAULTS.employerNpsRate;
  const gratuityRate = input.gratuityRate ?? SALARY_DEFAULTS.gratuityRate;

  const basic = roundToPaise(input.ctc * basicRate);
  const hra = roundToPaise(basic * hraRate);
  const employerPf = roundToPaise(basic * employerPfRate);
  const employerNps = roundToPaise(basic * employerNpsRate);
  const gratuity = roundToPaise(basic * gratuityRate);

  const named = basic + hra + employerPf + employerNps + gratuity;
  const specialAllowance = roundToPaise(Math.max(0, input.ctc - named));

  const gross = roundToPaise(basic + hra + specialAllowance);
  const employeePf = roundToPaise(basic * employerPfRate);

  return {
    ctc: roundToPaise(input.ctc),
    basic,
    hra,
    specialAllowance,
    employerPf,
    employerNps,
    gratuity,
    gross,
    employeePf,
    cityClass,
  };
}

export interface HraExemptionInput {
  readonly hraReceived: number;
  readonly basic: number;
  /** Annual rent actually paid. Zero means no exemption. */
  readonly rentPaid: number;
  readonly cityClass: CityClass;
}

export interface HraExemption {
  readonly exempt: number;
  /** The three statutory candidates, exposed so the UI can show the working. */
  readonly received: number;
  readonly rentOverTenPercent: number;
  readonly shareOfBasic: number;
}

/**
 * HRA exemption under Rule 2A: the least of three amounts.
 *
 * "Salary" for this rule means basic + dearness allowance. We have no DA
 * component, so basic stands in for it.
 *
 * The rent-minus-10%-of-basic leg can go negative when rent is low; it is
 * floored at zero, which is what makes a nil-rent claim correctly exempt
 * nothing rather than exempting a negative amount.
 */
export function hraExemption(input: HraExemptionInput): HraExemption {
  const shareRate = input.cityClass === 'metro' ? 0.5 : 0.4;

  const received = roundToPaise(Math.max(0, input.hraReceived));
  const rentOverTenPercent = roundToPaise(Math.max(0, input.rentPaid - 0.1 * input.basic));
  const shareOfBasic = roundToPaise(Math.max(0, input.basic * shareRate));

  return {
    exempt: roundToPaise(Math.min(received, rentOverTenPercent, shareOfBasic)),
    received,
    rentOverTenPercent,
    shareOfBasic,
  };
}
