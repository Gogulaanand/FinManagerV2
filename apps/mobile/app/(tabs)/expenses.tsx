import { AccountSchema, CategorySchema, type Account, type Transaction } from '@finmanager/schema';
import { budgetRatio } from '@finmanager/core';
import { useStatus } from '@powersync/react';
import { router, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Amount } from '../../components/amount';
import { Card, CardLabel, CardTitle } from '../../components/card';
import { MobileExpenseCharts } from '../../components/expenses/expense-charts';
import { TransactionRow } from '../../components/expenses/transaction-row';
import { MonthPickerSheet } from '../../components/expenses/month-picker-sheet';
import { Fab } from '../../components/fab';
import { ExpenseSetupSections } from '../../components/expenses/expense-setup-sections';
import { MobileWorkspaceSkeleton, useInitialSkeleton } from '../../components/motion';
import { useExpenses } from '../../lib/expenses';
import { useNotice } from '../../lib/notice';
import { useAuth } from '../../components/providers';

export default function ExpensesScreen() {
  const status = useStatus();
  const { session, loading } = useAuth();
  if (loading || (session !== null && !status.hasSynced)) {
    return <MobileWorkspaceSkeleton label="Loading expenses" />;
  }
  return <ExpensesScreenContent />;
}

function ExpensesScreenContent() {
  const api = useExpenses();
  const initialSkeleton = useInitialSkeleton();
  const notice = useNotice();
  const [accountName, setAccountName] = useState('');
  const [accountType, setAccountType] = useState<Account['type']>('bank');
  const [accountBalance, setAccountBalance] = useState('');
  const [categoryName, setCategoryName] = useState('');
  const [categoryKind, setCategoryKind] = useState<'expense' | 'income'>('expense');
  const editTransaction = useCallback((transaction: Transaction) => {
    if (transaction.id) router.push(`/transaction/${transaction.id}` as Href);
  }, []);
  const deleteTransaction = useCallback(
    (transaction: Transaction) => {
      if (!transaction.id) return;
      Alert.alert('Delete transaction?', 'This cannot be undone.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => void api.deleteTransaction(transaction.id!),
        },
      ]);
    },
    [api],
  );

  async function saveAccount() {
    const parsed = AccountSchema.safeParse({
      name: accountName,
      type: accountType,
      currentBalance: Number.parseFloat(accountBalance) || 0,
    });
    if (!parsed.success) return;
    await api.saveAccount(parsed.data);
    setAccountName('');
    setAccountBalance('');
  }
  async function saveCategory() {
    const parsed = CategorySchema.safeParse({ name: categoryName, kind: categoryKind });
    if (!parsed.success) return;
    await api.saveCategory(parsed.data);
    setCategoryName('');
  }

  if (api.loading || initialSkeleton) return <MobileWorkspaceSkeleton label="Loading expenses" />;
  const header = (
    <View className="gap-4 p-4 pb-0">
      <View className="flex-row items-end justify-between gap-3">
        <View className="flex-1">
          <Text className="font-display text-headline-lg text-foreground">Expenses</Text>
          <Text className="font-body text-body-md text-foreground-muted">
            Track spending, income, and the month ahead.
          </Text>
        </View>
      </View>
      {!api.canWrite ? (
        <Card>
          <Text className="font-body text-body-md text-foreground-muted">
            Sign in to save expenses offline and sync them across devices.
          </Text>
        </Card>
      ) : null}
      {notice ? (
        <Text className="font-body text-caption text-foreground-muted">{notice}</Text>
      ) : null}
      <View className="flex-row items-center justify-between">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          onPress={api.previousMonth}
          className="rounded-md bg-surface-muted px-4 py-2"
        >
          <Text className="text-foreground">←</Text>
        </Pressable>
        <MonthPickerSheet month={api.month} onChange={api.setMonth} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next month"
          onPress={api.nextMonth}
          className="rounded-md bg-surface-muted px-4 py-2"
        >
          <Text className="text-foreground">→</Text>
        </Pressable>
      </View>
      <View className="flex-row gap-2">
        <Card className="min-w-0 flex-1">
          <CardLabel>Spent</CardLabel>
          <Amount value={api.summary.debit} size="tile" />
        </Card>
        <Card className="min-w-0 flex-1">
          <CardLabel>Income</CardLabel>
          <Amount value={api.summary.credit} size="tile" />
        </Card>
        <Card className="min-w-0 flex-1">
          <CardLabel>Net</CardLabel>
          <Amount value={api.summary.net} size="tile" signed />
        </Card>
      </View>
      <View className="flex-row items-center justify-between rounded-t-lg bg-surface px-4 pt-4">
        <CardTitle>Transactions</CardTitle>
        <Text className="font-body text-caption text-foreground-muted">
          {api.monthTransactions.length} of {api.monthTransactionCount}
        </Text>
      </View>
    </View>
  );

  const footer = (
    <View className="gap-4 p-4">
      <Card>
        <View className="flex-row items-center justify-between">
          <CardTitle>Budgets</CardTitle>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/budget' as Href)}
            disabled={!api.canWrite}
            className="rounded-md bg-primary px-3 py-2 disabled:opacity-50"
          >
            <Text className="text-primary-foreground">Set budget</Text>
          </Pressable>
        </View>
        {api.budgetProgress.length === 0 ? (
          <Text className="mt-2 text-foreground-muted">
            Set a category budget to see progress here.
          </Text>
        ) : (
          <View className="mt-3 gap-3">
            {api.budgetProgress.map((item) => (
              <View
                key={`${item.categoryId ?? 'uncategorised'}-${item.budgetId ?? item.label}`}
                className="gap-1"
              >
                <View className="flex-row justify-between">
                  <Text className="text-foreground">{item.label}</Text>
                  <Text
                    className={item.status === 'overspent' ? 'text-loss' : 'text-foreground-muted'}
                  >
                    ₹{item.actual.toLocaleString('en-IN')} / ₹{item.budget.toLocaleString('en-IN')}
                  </Text>
                </View>
                <View className="h-2 overflow-hidden rounded-full bg-surface-muted">
                  <View
                    className={`h-full rounded-full ${item.status === 'overspent' ? 'bg-loss' : item.status === 'nearLimit' ? 'bg-warning' : 'bg-gain'}`}
                    style={{
                      width: `${Math.min(budgetRatio(item.actual, item.budget), 1) * 100}%`,
                    }}
                  />
                </View>
                {item.budgetId ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() =>
                      Alert.alert('Clear budget?', `Remove the ${item.label} budget?`, [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Clear',
                          style: 'destructive',
                          onPress: () => void api.deleteBudget(item.budgetId!),
                        },
                      ])
                    }
                  >
                    <Text className="text-caption text-loss">Clear</Text>
                  </Pressable>
                ) : null}
              </View>
            ))}
          </View>
        )}
      </Card>
      <ExpenseSetupSections
        api={api}
        accountName={accountName}
        accountType={accountType}
        accountBalance={accountBalance}
        categoryName={categoryName}
        categoryKind={categoryKind}
        setAccountName={setAccountName}
        setAccountType={setAccountType}
        setAccountBalance={setAccountBalance}
        setCategoryName={setCategoryName}
        setCategoryKind={(value) => setCategoryKind(value as 'expense' | 'income')}
        saveAccount={saveAccount}
        saveCategory={saveCategory}
      />
      <MobileExpenseCharts
        monthlyTrend={api.monthlyTrend}
        categoryBreakdown={api.categoryBreakdown}
        budgetChart={api.budgetChart}
      />
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <FlatList
        data={api.monthTransactions}
        keyExtractor={(transaction) =>
          transaction.id ?? `${transaction.occurredOn}-${transaction.amount}`
        }
        renderItem={({ item }) => (
          <TransactionRow
            transaction={item}
            category={api.categories.find((category) => category.id === item.categoryId)}
            onEdit={editTransaction}
            onDelete={deleteTransaction}
          />
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <View className="mx-4 bg-surface p-4">
            <Text className="text-foreground-muted">
              Add your first expense to start the month.
            </Text>
          </View>
        }
        ListFooterComponent={footer}
        onEndReached={() => {
          if (api.hasMoreTransactions) api.loadMoreTransactions();
        }}
        onEndReachedThreshold={0.4}
        contentContainerClassName="pb-28"
      />
      <Fab
        icon="receipt"
        label="Add transaction"
        onPress={() => router.push('/transaction/new' as Href)}
        disabled={!api.canWrite}
      />
    </SafeAreaView>
  );
}
