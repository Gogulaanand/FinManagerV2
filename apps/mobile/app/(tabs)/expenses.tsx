import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Amount } from '../../components/amount';
import { Card, CardLabel, CardTitle } from '../../components/card';
import { MobileExpenseCharts } from '../../components/expenses/expense-charts';
import { MobileTransactionForm } from '../../components/expenses/transaction-form';
import { useExpenses } from '../../lib/expenses';

function monthLabel(month: string): string {
  return new Date(`${month}-01T00:00:00.000Z`).toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function signedAmount(direction: 'debit' | 'credit', amount: number): number {
  return direction === 'debit' ? -amount : amount;
}

export default function ExpensesScreen() {
  const api = useExpenses();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const editing = api.transactions.find((transaction) => transaction.id === editingId) ?? null;
  const monthTransactions = api.transactions.filter((transaction) =>
    transaction.occurredOn.startsWith(api.month),
  );

  if (formOpen) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={['top']}>
        <MobileTransactionForm
          key={editing?.id ?? 'new'}
          accounts={api.accounts}
          categories={api.categories}
          initialTransaction={editing}
          onSave={async (transaction) => {
            await api.saveTransaction(transaction);
            setFormOpen(false);
            setEditingId(null);
          }}
          onCancel={() => {
            setFormOpen(false);
            setEditingId(null);
          }}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView className="flex-1" contentContainerClassName="gap-4 p-4 pb-12">
        <View className="flex-row items-end justify-between gap-3">
          <View className="flex-1">
            <Text className="font-display text-headline-lg text-foreground">Expenses</Text>
            <Text className="font-body text-body-md text-foreground-muted">
              Track spending, income, and the month ahead.
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setEditingId(null);
              setFormOpen(true);
            }}
            disabled={!api.canWrite}
            className="rounded-md bg-primary px-3 py-2 active:opacity-80 disabled:opacity-50"
          >
            <Text className="font-body text-label text-primary-foreground">Add</Text>
          </Pressable>
        </View>

        {!api.canWrite ? (
          <Card>
            <Text className="font-body text-body-md text-foreground-muted">
              Sign in to save expenses offline and sync them across devices.
            </Text>
          </Card>
        ) : null}

        <View className="flex-row items-center justify-between">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Previous month"
            onPress={api.previousMonth}
            className="rounded-md bg-surface-muted px-4 py-2"
          >
            <Text className="font-body text-body-md text-foreground">←</Text>
          </Pressable>
          <Text className="font-body text-body-md text-foreground">{monthLabel(api.month)}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Next month"
            onPress={api.nextMonth}
            className="rounded-md bg-surface-muted px-4 py-2"
          >
            <Text className="font-body text-body-md text-foreground">→</Text>
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

        <Card>
          <View className="mb-3 flex-row items-center justify-between">
            <CardTitle>Transactions</CardTitle>
            <Text className="font-body text-caption text-foreground-muted">
              {monthTransactions.length} this month
            </Text>
          </View>
          {monthTransactions.length === 0 ? (
            <Text className="font-body text-body-md text-foreground-muted">
              Add your first expense to start the month.
            </Text>
          ) : (
            <View className="gap-3">
              {monthTransactions.map((transaction) => {
                const category = api.categories.find((item) => item.id === transaction.categoryId);
                return (
                  <View
                    key={transaction.id}
                    className="flex-row items-center gap-2 border-b border-border/60 pb-3 last:border-b-0 last:pb-0"
                  >
                    <View className="min-w-0 flex-1">
                      <Text numberOfLines={1} className="font-body text-body-md text-foreground">
                        {transaction.merchant || transaction.note || 'Transaction'}
                      </Text>
                      <Text className="font-body text-caption text-foreground-muted">
                        {category?.name ?? 'Uncategorised'} · {transaction.occurredOn}
                      </Text>
                    </View>
                    <Amount
                      value={signedAmount(transaction.direction, transaction.amount)}
                      signed
                    />
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Edit transaction"
                      onPress={() => {
                        setEditingId(transaction.id ?? null);
                        setFormOpen(true);
                      }}
                      className="rounded-md bg-surface-muted px-2 py-2"
                    >
                      <Text className="font-body text-caption text-foreground">Edit</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Delete transaction"
                      onPress={() => {
                        if (transaction.id) void api.deleteTransaction(transaction.id);
                      }}
                      className="rounded-md bg-surface-muted px-2 py-2"
                    >
                      <Text className="font-body text-caption text-loss">Delete</Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          )}
        </Card>

        <Card>
          <CardTitle>Budgets</CardTitle>
          {api.budgetProgress.length === 0 ? (
            <Text className="mt-2 font-body text-body-md text-foreground-muted">
              Set a budget on web to see progress here.
            </Text>
          ) : (
            <View className="mt-3 gap-3">
              {api.budgetProgress.map((item) => (
                <View
                  key={`${item.categoryId ?? 'uncategorised'}-${item.budgetId ?? item.label}`}
                  className="gap-1"
                >
                  <View className="flex-row justify-between gap-2">
                    <Text className="font-body text-body-md text-foreground">{item.label}</Text>
                    <Text
                      className={`font-body text-label ${item.status === 'overspent' ? 'text-loss' : 'text-foreground-muted'}`}
                    >
                      ₹{item.actual.toLocaleString('en-IN')} / ₹
                      {item.budget.toLocaleString('en-IN')}
                    </Text>
                  </View>
                  <View className="h-2 overflow-hidden rounded-full bg-surface-muted">
                    <View
                      className={`h-full rounded-full ${item.status === 'overspent' ? 'bg-loss' : item.status === 'nearLimit' ? 'bg-warning' : 'bg-gain'}`}
                      style={{ width: `${Math.min(item.ratio * 100, 100)}%` }}
                    />
                  </View>
                </View>
              ))}
            </View>
          )}
        </Card>

        <MobileExpenseCharts
          monthlyTrend={api.monthlyTrend}
          categoryBreakdown={api.categoryBreakdown}
          budgetChart={api.budgetChart}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
