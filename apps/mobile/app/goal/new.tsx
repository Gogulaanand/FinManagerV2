import { router } from 'expo-router';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MobileGoalForm } from '../../components/goals/goal-form';
import { MobileWorkspaceSkeleton } from '../../components/motion';
import { setNotice } from '../../lib/notice';
import { useGoals } from '../../lib/goals';

export default function NewGoalRoute() {
  const api = useGoals();
  if (api.loading) return <MobileWorkspaceSkeleton label="Loading goal form" />;
  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView contentContainerClassName="gap-4 p-4 pb-12">
        <MobileGoalForm
          holdings={api.holdings}
          onSave={async (goal) => {
            await api.saveGoal(goal);
            setNotice('Goal saved locally.');
            router.back();
          }}
          onCancel={() => router.back()}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
