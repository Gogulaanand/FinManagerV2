import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MobileBudgetForm } from '../../components/expenses/budget-form';
import { MobileWorkspaceSkeleton } from '../../components/motion';
import { setNotice } from '../../lib/notice';
import { useExpenses } from '../../lib/expenses';

export default function BudgetRoute() {
  const api = useExpenses();
  if (api.loading) return <MobileWorkspaceSkeleton label="Loading budget form" />;
  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <MobileBudgetForm
        month={api.month}
        categories={api.categories}
        existing={api.budgetProgress}
        onSave={async (budget) => {
          await api.saveBudget(budget);
          setNotice('Budget saved locally.');
          router.back();
        }}
        onCancel={() => router.back()}
      />
    </SafeAreaView>
  );
}
