export interface XirrCashFlow {
  readonly date: string;
  readonly amount: number;
}

export interface XirrOptions {
  readonly tolerance?: number;
  readonly maxIterations?: number;
}

export type XirrResult =
  | { readonly status: 'ok'; readonly rate: number; readonly iterations: number }
  | {
      readonly status:
        | 'invalid-input'
        | 'insufficient-sign-diversity'
        | 'insufficient-date-span'
        | 'missing-fx'
        | 'no-bracket'
        | 'no-convergence';
      readonly rate: null;
      readonly iterations: number;
    };

interface ParsedCashFlow extends XirrCashFlow {
  readonly time: number;
}

const DAYS_PER_YEAR = 365;
const LOWER_BOUND = -0.999999999;
const INITIAL_UPPER_BOUND = 1;
const MAX_UPPER_BOUND = 1_000_000;

function parseDate(value: string): number {
  const time = Date.parse(`${value}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(time)) {
    throw new RangeError(`Invalid cash-flow date: ${value}`);
  }
  return time;
}

function parseCashFlows(cashFlows: readonly XirrCashFlow[]): readonly ParsedCashFlow[] {
  if (cashFlows.length === 0) return [];
  const firstTime = parseDate(cashFlows[0]!.date);
  const parsed = cashFlows
    .map((flow) => {
      if (!Number.isFinite(flow.amount) || flow.amount === 0) {
        throw new RangeError('XIRR cash-flow amounts must be finite and non-zero');
      }
      const time = parseDate(flow.date);
      return {
        date: flow.date,
        amount: flow.amount,
        time: (time - firstTime) / 86_400_000 / DAYS_PER_YEAR,
      };
    })
    .sort((left, right) => left.time - right.time);
  const combined: ParsedCashFlow[] = [];
  for (const flow of parsed) {
    const previous = combined.at(-1);
    if (previous && previous.time === flow.time) {
      combined[combined.length - 1] = { ...previous, amount: previous.amount + flow.amount };
    } else {
      combined.push(flow);
    }
  }
  return combined.filter((flow) => flow.amount !== 0);
}

function netPresentValue(cashFlows: readonly ParsedCashFlow[], rate: number): number {
  if (rate <= LOWER_BOUND || !Number.isFinite(rate)) return Number.NaN;
  const base = 1 + rate;
  return cashFlows.reduce((sum, flow) => sum + flow.amount / Math.pow(base, flow.time), 0);
}

function derivative(cashFlows: readonly ParsedCashFlow[], rate: number): number {
  const base = 1 + rate;
  return cashFlows.reduce(
    (sum, flow) => sum - (flow.time * flow.amount) / Math.pow(base, flow.time + 1),
    0,
  );
}

export function calculateXirr(
  cashFlows: readonly XirrCashFlow[],
  options: XirrOptions = {},
): XirrResult {
  let parsed: readonly ParsedCashFlow[];
  try {
    parsed = parseCashFlows(cashFlows);
  } catch {
    return { status: 'invalid-input', rate: null, iterations: 0 };
  }
  if (cashFlows.length > 1 && cashFlows.every((flow) => flow.date === cashFlows[0]!.date)) {
    return { status: 'insufficient-date-span', rate: null, iterations: 0 };
  }
  const hasNegative = parsed.some((flow) => flow.amount < 0);
  const hasPositive = parsed.some((flow) => flow.amount > 0);
  if (!hasNegative || !hasPositive) {
    return { status: 'insufficient-sign-diversity', rate: null, iterations: 0 };
  }
  if (parsed.length < 2 || parsed.at(-1)!.time === parsed[0]!.time) {
    return { status: 'insufficient-date-span', rate: null, iterations: 0 };
  }

  const tolerance = options.tolerance ?? 1e-9;
  const maxIterations = options.maxIterations ?? 100;
  let lowerRate = LOWER_BOUND + 1e-12;
  let upperRate = INITIAL_UPPER_BOUND;
  let lowerValue = netPresentValue(parsed, lowerRate);
  let upperValue = netPresentValue(parsed, upperRate);
  while (
    Number.isFinite(lowerValue) &&
    Number.isFinite(upperValue) &&
    Math.sign(lowerValue) === Math.sign(upperValue) &&
    upperRate < MAX_UPPER_BOUND
  ) {
    upperRate *= 2;
    upperValue = netPresentValue(parsed, upperRate);
  }
  if (!Number.isFinite(lowerValue) || !Number.isFinite(upperValue)) {
    return { status: 'no-bracket', rate: null, iterations: 0 };
  }
  if (Math.sign(lowerValue) === Math.sign(upperValue)) {
    return { status: 'no-bracket', rate: null, iterations: 0 };
  }

  let guess = 0.1;
  if (guess <= lowerRate || guess >= upperRate) guess = (lowerRate + upperRate) / 2;
  for (let iteration = 1; iteration <= maxIterations; iteration += 1) {
    const value = netPresentValue(parsed, guess);
    if (Number.isFinite(value) && Math.abs(value) <= tolerance) {
      return { status: 'ok', rate: guess, iterations: iteration };
    }

    if (Number.isFinite(value)) {
      if (Math.sign(value) === Math.sign(lowerValue)) {
        lowerRate = guess;
        lowerValue = value;
      } else {
        upperRate = guess;
        upperValue = value;
      }
    }

    const slope = derivative(parsed, guess);
    const newton = Number.isFinite(slope) && slope !== 0 ? guess - value / slope : Number.NaN;
    const next =
      Number.isFinite(newton) && newton > lowerRate && newton < upperRate
        ? newton
        : (lowerRate + upperRate) / 2;
    if (Math.abs(next - guess) <= tolerance) {
      const nextValue = netPresentValue(parsed, next);
      if (Number.isFinite(nextValue) && Math.abs(nextValue) <= tolerance) {
        return { status: 'ok', rate: next, iterations: iteration };
      }
      return { status: 'no-convergence', rate: null, iterations: iteration };
    }
    guess = next;
  }
  return { status: 'no-convergence', rate: null, iterations: maxIterations };
}
