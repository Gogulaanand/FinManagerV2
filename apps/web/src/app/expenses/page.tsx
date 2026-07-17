import { Receipt } from 'lucide-react';

import { ModulePlaceholder } from '@/components/module-placeholder';

export default function ExpensesPage() {
  return (
    <ModulePlaceholder
      title="Expenses"
      phase={4}
      icon={Receipt}
      summary="Fast offline expense entry, category budgets, and month-on-month spend trends."
    />
  );
}
