import type { Metadata } from 'next';

import { PrivacyPage } from '@/components/privacy/privacy-page';

export const metadata: Metadata = {
  title: 'Privacy & data | FinManager',
  description: 'How the FinManager web beta stores, syncs, exports, and uses your data.',
};

export default function PrivacyRoute() {
  return <PrivacyPage />;
}
