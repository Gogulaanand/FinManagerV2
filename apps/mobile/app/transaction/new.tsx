import { router } from 'expo-router';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MobileTransactionForm } from '../../components/expenses/transaction-form';
import { MobileWorkspaceSkeleton } from '../../components/motion';
import { setNotice } from '../../lib/notice';
import { useExpenses } from '../../lib/expenses';

export default function NewTransactionRoute() {
  const api = useExpenses();
  if (api.loading) return <MobileWorkspaceSkeleton label="Loading transaction form" />;
  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView contentContainerClassName="gap-4 p-4 pb-12">
        <MobileTransactionForm
          accounts={api.accounts}
          categories={api.categories}
          onSave={async (transaction) => {
            await api.saveTransaction(transaction);
            setNotice('Transaction saved locally.');
            router.back();
          }}
          onCancel={() => router.back()}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
