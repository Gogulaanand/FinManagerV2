import { HoldingDetail } from '@/components/portfolio/holding-detail';

export default async function HoldingPage({
  params,
}: {
  readonly params: Promise<{ holdingId: string }>;
}) {
  const { holdingId } = await params;
  return <HoldingDetail holdingId={holdingId} />;
}
