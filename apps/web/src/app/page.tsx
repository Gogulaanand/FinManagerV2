import { roundToPaise } from '@finmanager/core';
import { MoneySchema } from '@finmanager/schema';
import { spacing } from '@finmanager/tokens';

// Phase 0 placeholder: renders values pulled through every shared package so the
// workspace wiring is proven in the running app, not just in unit tests.
const sample = MoneySchema.parse({ amount: roundToPaise(123456.789) });

export default function HomePage() {
  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center"
      style={{ gap: spacing.md }}
    >
      <h1 className="text-3xl font-semibold tracking-tight">FinManager</h1>
      <p className="text-sm opacity-70">Phase 0 - monorepo foundation</p>
      <p className="font-mono text-lg">
        {sample.currency} {sample.amount.toLocaleString('en-IN')}
      </p>
    </main>
  );
}
