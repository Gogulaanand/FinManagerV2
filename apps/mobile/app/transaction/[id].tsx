import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView } from 'react-native';
import { useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MobileTransactionForm } from '../../components/expenses/transaction-form';
import { MobileWorkspaceSkeleton } from '../../components/motion';
import { setNotice } from '../../lib/notice';
import { useExpenses } from '../../lib/expenses';

export default function EditTransactionRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const api = useExpenses();
  const initial = api.monthTransactions.find((transaction) => transaction.id === id) ?? null;
  useEffect(() => {
    if (initial) return;
    const timeout = setTimeout(() => router.back(), 5000);
    return () => clearTimeout(timeout);
  }, [initial]);
  if (api.loading || !initial) return <MobileWorkspaceSkeleton label="Loading transaction" />;
  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView contentContainerClassName="gap-4 p-4 pb-12">
        <MobileTransactionForm
          key={initial.id}
          accounts={api.accounts}
          categories={api.categories}
          initialTransaction={initial}
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
