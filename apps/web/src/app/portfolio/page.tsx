import { TrendingUp } from 'lucide-react';

import { ModulePlaceholder } from '@/components/module-placeholder';

export default function PortfolioPage() {
  return (
    <ModulePlaceholder
      title="Portfolio"
      phase={5}
      icon={TrendingUp}
      summary="Holdings across equity, mutual funds, EPF, and NPS, with XIRR and asset allocation."
    />
  );
}
