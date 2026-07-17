import { Settings } from 'lucide-react';

import { ModulePlaceholder } from '@/components/module-placeholder';

export default function SettingsPage() {
  return (
    <ModulePlaceholder
      title="Settings"
      phase={3}
      icon={Settings}
      summary="Account, sync status, and data export. Sign-in arrives with the offline-first data layer."
    />
  );
}
