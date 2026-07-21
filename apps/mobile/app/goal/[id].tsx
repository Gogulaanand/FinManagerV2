import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView } from 'react-native';
import { useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MobileGoalForm } from '../../components/goals/goal-form';
import { MobileWorkspaceSkeleton } from '../../components/motion';
import { setNotice } from '../../lib/notice';
import { useGoals } from '../../lib/goals';

export default function EditGoalRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const api = useGoals();
  const initial = api.goals.find((goal) => goal.id === id) ?? null;
  useEffect(() => {
    if (initial) return;
    const timeout = setTimeout(() => router.back(), 5000);
    return () => clearTimeout(timeout);
  }, [initial]);
  if (api.loading || !initial) return <MobileWorkspaceSkeleton label="Loading goal" />;
  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView contentContainerClassName="gap-4 p-4 pb-12">
        <MobileGoalForm
          key={initial.id}
          initial={initial}
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
