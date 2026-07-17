import { Target } from 'lucide-react';

import { ModulePlaceholder } from '@/components/module-placeholder';

export default function GoalsPage() {
  return (
    <ModulePlaceholder
      title="Goals"
      phase={6}
      icon={Target}
      summary="Retirement projections, FIRE targets, and progress against the goals you set."
    />
  );
}
