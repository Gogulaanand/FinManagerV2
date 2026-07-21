import type { RetirementCorpus } from '@finmanager/core';

import { Amount } from '@/components/amount';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';

export function RetirementSummary({
  retirement,
}: {
  readonly retirement: RetirementCorpus;
}): React.JSX.Element {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Retirement corpus</CardTitle>
        <span className="font-body text-caption text-foreground-muted">EPF · PPF · NPS</span>
      </CardHeader>
      <Amount value={retirement.total} size="section" />
      {retirement.rows.length === 0 ? (
        <p className="mt-2 font-body text-body-md text-foreground-muted">
          Add EPF, PPF, or NPS holdings in Portfolio to build your retirement corpus.
        </p>
      ) : (
        <div className="mt-3 flex flex-col gap-2">
          {retirement.rows.map((row) => (
            <div
              key={row.holdingId}
              className="flex items-center justify-between border-b border-border/60 pb-2 last:border-0"
            >
              <span className="font-body text-body-md text-foreground">
                {row.name} <span className="text-foreground-muted uppercase">{row.type}</span>
              </span>
              <Amount value={row.value} />
            </div>
          ))}
        </div>
      )}
      {retirement.missingValueCount > 0 || retirement.missingFxCount > 0 ? (
        <p className="mt-2 font-body text-caption text-loss">
          {retirement.missingValueCount} unvalued · {retirement.missingFxCount} missing FX
        </p>
      ) : null}
    </Card>
  );
}
