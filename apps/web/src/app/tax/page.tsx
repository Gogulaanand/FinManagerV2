import { Landmark } from 'lucide-react';

import { ModulePlaceholder } from '@/components/module-placeholder';

export default function TaxPage() {
  return (
    <ModulePlaceholder
      title="Tax"
      phase={2}
      icon={Landmark}
      summary="Old vs new regime comparison, slab-by-slab breakdown, and deductions under 80C, 80D, and HRA."
    />
  );
}
