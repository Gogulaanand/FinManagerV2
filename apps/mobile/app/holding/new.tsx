import { router } from 'expo-router';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MobileHoldingForm } from '../../components/portfolio/holding-form';
import { MobileWorkspaceSkeleton } from '../../components/motion';
import { setNotice } from '../../lib/notice';
import { usePortfolio } from '../../lib/portfolio';

export default function NewHoldingRoute() {
  const api = usePortfolio();
  if (api.loading) return <MobileWorkspaceSkeleton label="Loading holding form" />;
  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView contentContainerClassName="gap-4 p-4 pb-12">
        <MobileHoldingForm
          onSave={async (holding) => {
            await api.saveHolding(holding);
            setNotice('Holding saved locally.');
            router.back();
          }}
          onCancel={() => router.back()}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
