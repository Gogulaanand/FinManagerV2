'use client';

import type { RegimeResult } from '@finmanager/core';
import { formatInr } from '@finmanager/core';

import { Amount } from '@/components/amount';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const REGIME_LABEL = {
  new: 'New regime',
  old: 'Old regime',
} as const;

const REGIME_CAPTION = {
  new: 'Lower rates, almost no deductions',
  old: 'Higher rates, full deductions',
} as const;

function Row({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <span className="font-body text-body-md text-foreground-muted">{label}</span>
      <span
        className={cn(
          'tabular font-body text-body-md',
          emphasis ? 'font-medium text-foreground' : 'text-foreground',
        )}
      >
        {value}
      </span>
    </div>
  );
}

export interface RegimeCardProps {
  result: RegimeResult;
  /** True for the regime with the higher take-home. */
  best: boolean;
  /** Annual rupees this regime gives up by not being the best one. */
  shortfall: number;
}

/**
 * One regime's outcome, headlined by monthly in-hand - the number people
 * actually recognise about their own salary.
 *
 * The winner is marked with a ring, a ▲ and the word "Best". None of those is
 * decorative: the design system forbids signalling an outcome by colour alone
 * (D-015), and a teal ring on its own would not survive greyscale.
 */
export function RegimeCard({ result, best, shortfall }: RegimeCardProps) {
  const { regime } = result;

  return (
    <Card className={cn('flex flex-col', best && 'ring-2 ring-primary')}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-headline-md text-foreground">{REGIME_LABEL[regime]}</h3>
          <p className="font-body text-caption text-foreground-muted">{REGIME_CAPTION[regime]}</p>
        </div>
        {best ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary px-2.5 py-1 font-body text-caption font-medium text-primary-foreground">
            <span aria-hidden="true">▲</span> Best
          </span>
        ) : (
          shortfall > 0 && (
            <span className="shrink-0 rounded-full bg-surface-muted px-2.5 py-1 font-body text-caption text-foreground-muted">
              {formatInr(shortfall)}/yr less
            </span>
          )
        )}
      </div>

      <p className="font-body text-label text-foreground-muted">Monthly in-hand</p>
      <Amount value={result.monthlyInHand} size="section" className="mb-4" />

      <div className="divide-y divide-border/50 border-t border-border/50 pt-1">
        <Row label="Annual in-hand" value={formatInr(result.annualInHand)} />
        <Row label="Gross salary" value={formatInr(result.gross)} />
        <Row label="Taxable income" value={formatInr(result.taxableIncome)} />
        <Row label="Total tax" value={formatInr(result.totalTax)} emphasis />
        <Row
          label="Effective rate"
          value={`${(result.effectiveRate * 100).toFixed(1)}% of gross`}
        />
      </div>

      <details className="group mt-4">
        <summary className="cursor-pointer list-none font-body text-label text-primary hover:underline">
          <span className="group-open:hidden">Show the working</span>
          <span className="hidden group-open:inline">Hide the working</span>
        </summary>

        <div className="mt-3 space-y-3">
          <div>
            <p className="mb-1 font-body text-caption text-foreground-muted">Deductions</p>
            <div className="divide-y divide-border/50">
              <Row label="Standard deduction" value={formatInr(-result.standardDeduction)} />
              {result.hraExempt > 0 && (
                <Row label="HRA exempt (Rule 2A)" value={formatInr(-result.hraExempt)} />
              )}
              {result.professionalTaxDeducted > 0 && (
                <Row label="Professional tax" value={formatInr(-result.professionalTaxDeducted)} />
              )}
              {result.chapterViA.section80C > 0 && (
                <Row label="80C" value={formatInr(-result.chapterViA.section80C)} />
              )}
              {result.chapterViA.section80CCD1B > 0 && (
                <Row label="80CCD(1B)" value={formatInr(-result.chapterViA.section80CCD1B)} />
              )}
              {result.chapterViA.section80D > 0 && (
                <Row label="80D" value={formatInr(-result.chapterViA.section80D)} />
              )}
              {result.chapterViA.employerNps > 0 && (
                <Row
                  label="80CCD(2) employer NPS"
                  value={formatInr(-result.chapterViA.employerNps)}
                />
              )}
            </div>
          </div>

          <div>
            <p className="mb-1 font-body text-caption text-foreground-muted">Slabs</p>
            <div className="divide-y divide-border/50">
              {result.slabBreakdown
                .filter((s) => s.taxableInBand > 0)
                .map((s) => (
                  <Row
                    key={`${String(s.from)}-${String(s.rate)}`}
                    label={`${formatInr(s.from)} - ${s.to === null ? 'above' : formatInr(s.to)} @ ${String(s.rate * 100)}%`}
                    value={formatInr(s.tax)}
                  />
                ))}
            </div>
          </div>

          <div>
            <p className="mb-1 font-body text-caption text-foreground-muted">Charge</p>
            <div className="divide-y divide-border/50">
              <Row label="Tax on slabs" value={formatInr(result.taxBeforeRebate)} />
              {result.rebate > 0 && (
                <Row label="Rebate (s.156)" value={formatInr(-result.rebate)} />
              )}
              {result.surcharge > 0 && (
                <Row
                  label={`Surcharge @ ${String(result.surchargeRate * 100)}%`}
                  value={formatInr(result.surcharge)}
                />
              )}
              {result.surchargeMarginalRelief > 0 && (
                <Row label="Marginal relief" value={formatInr(-result.surchargeMarginalRelief)} />
              )}
              <Row label="Health & education cess @ 4%" value={formatInr(result.cess)} />
              <Row label="Total tax" value={formatInr(result.totalTax)} emphasis />
            </div>
          </div>
        </div>
      </details>
    </Card>
  );
}
