import { useLocalSearchParams } from 'expo-router';

import { MobileHoldingDetail } from '../../components/portfolio/holding-detail';

export default function HoldingRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <MobileHoldingDetail holdingId={id} />;
}
