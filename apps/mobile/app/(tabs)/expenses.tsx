import {
  AccountSchema,
  BudgetSchema,
  CategorySchema,
  type Account,
  type Budget,
  type Category,
  type Transaction,
} from '@finmanager/schema';
import { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Amount } from '../../components/amount';
import { Card, CardLabel, CardTitle } from '../../components/card';
import { Collapsible } from '../../components/collapsible';
import { MobileExpenseCharts } from '../../components/expenses/expense-charts';
import { TransactionRow } from '../../components/expenses/transaction-row';
import { MobileTransactionForm } from '../../components/expenses/transaction-form';
import { Field, Segmented } from '../../components/field';
import { MobileWorkspaceSkeleton, useInitialSkeleton } from '../../components/motion';
import { useExpenses } from '../../lib/expenses';

function monthLabel(month: string): string {
  return new Date(`${month}-01T00:00:00.000Z`).toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
}: {
  readonly label: string;
  readonly value: string;
  readonly onChangeText: (value: string) => void;
  readonly placeholder?: string;
  readonly keyboardType?: 'default' | 'decimal-pad' | 'number-pad';
}) {
  return (
    <Field label={label}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        keyboardType={keyboardType}
        className="h-11 rounded-md border border-border bg-background px-3 font-body text-body-md text-foreground"
      />
    </Field>
  );
}

function ChoiceRow({
  label,
  value,
  options,
  onChange,
}: {
  readonly label: string;
  readonly value: string;
  readonly options: readonly { value: string; label: string }[];
  readonly onChange: (value: string) => void;
}) {
  return (
    <Field label={label}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="gap-2"
      >
        {options.map((option) => (
          <Text
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="button"
            className={`rounded-full px-3 py-2 font-body text-label ${option.value === value ? 'bg-primary text-primary-foreground' : 'bg-surface-muted text-foreground'}`}
          >
            {option.label}
          </Text>
        ))}
      </ScrollView>
    </Field>
  );
}

function MobileBudgetForm({
  month,
  categories,
  existing,
  onSave,
  onCancel,
}: {
  readonly month: string;
  readonly categories: readonly Category[];
  readonly existing: readonly { categoryId: string | null; budgetId: string | null }[];
  readonly onSave: (budget: Budget) => Promise<void>;
  readonly onCancel: () => void;
}) {
  const expenseCategories = categories.filter((category) => category.kind === 'expense');
  const [categoryId, setCategoryId] = useState(expenseCategories[0]?.id ?? '');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  async function submit() {
    const parsed = BudgetSchema.safeParse({
      categoryId: categoryId || null,
      period: 'monthly',
      periodStart: `${month}-01`,
      amount: Number.parseFloat(amount),
      id: existing.find((item) => item.categoryId === (categoryId || null))?.budgetId ?? undefined,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Enter a positive budget');
      return;
    }
    setError(null);
    await onSave(parsed.data);
  }
  return (
    <ScrollView className="flex-1" contentContainerClassName="gap-4 p-4 pb-12">
      <View>
        <Text className="font-display text-headline-lg text-foreground">Set monthly budget</Text>
        <Text className="font-body text-body-md text-foreground-muted">{month}</Text>
      </View>
      <Card className="gap-4">
        <ChoiceRow
          label="Category"
          value={categoryId}
          options={expenseCategories.map((category) => ({
            value: category.id!,
            label: category.name,
          }))}
          onChange={setCategoryId}
        />
        <TextField
          label="Budget"
          value={amount}
          onChangeText={setAmount}
          placeholder="₹ amount"
          keyboardType="decimal-pad"
        />
        {error ? <Text className="font-body text-caption text-loss">{error}</Text> : null}
        <View className="flex-row gap-2">
          <Pressable
            accessibilityRole="button"
            onPress={onCancel}
            className="flex-1 rounded-md bg-surface-muted py-3"
          >
            <Text className="text-center text-foreground">Cancel</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => void submit()}
            className="flex-1 rounded-md bg-primary py-3"
          >
            <Text className="text-center text-primary-foreground">Save</Text>
          </Pressable>
        </View>
      </Card>
    </ScrollView>
  );
}

export default function ExpensesScreen() {
  const api = useExpenses();
  const initialSkeleton = useInitialSkeleton();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [accountName, setAccountName] = useState('');
  const [accountType, setAccountType] = useState<Account['type']>('bank');
  const [accountBalance, setAccountBalance] = useState('');
  const [categoryName, setCategoryName] = useState('');
  const [categoryKind, setCategoryKind] = useState<'expense' | 'income'>('expense');
  const editing = api.monthTransactions.find((transaction) => transaction.id === editingId) ?? null;

  const editTransaction = useCallback((transaction: Transaction) => {
    setEditingId(transaction.id ?? null);
    setFormOpen(true);
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
  if (formOpen)
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
  if (budgetOpen)
    return (
      <SafeAreaView className="flex-1 bg-background" edges={['top']}>
        <MobileBudgetForm
          month={api.month}
          categories={api.categories}
          existing={api.budgetProgress}
          onSave={async (budget) => {
            await api.saveBudget(budget);
            setBudgetOpen(false);
          }}
          onCancel={() => setBudgetOpen(false)}
        />
      </SafeAreaView>
    );

  const header = (
    <View className="gap-4 p-4 pb-0">
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
          className="rounded-md bg-primary px-3 py-2 disabled:opacity-50"
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
          <Text className="text-foreground">←</Text>
        </Pressable>
        <Text className="font-body text-body-md text-foreground">{monthLabel(api.month)}</Text>
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
            onPress={() => setBudgetOpen(true)}
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
                    style={{ width: `${Math.min(item.ratio * 100, 100)}%` }}
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
      <Card>
        <Collapsible title="Accounts" count={api.accounts.length}>
          <TextField
            label="Name"
            value={accountName}
            onChangeText={setAccountName}
            placeholder="Bank account"
          />
          <ChoiceRow
            label="Type"
            value={accountType}
            options={[
              { value: 'bank', label: 'Bank' },
              { value: 'wallet', label: 'Wallet' },
              { value: 'cash', label: 'Cash' },
              { value: 'credit_card', label: 'Card' },
              { value: 'broker', label: 'Broker' },
            ]}
            onChange={(value) => setAccountType(value as Account['type'])}
          />
          <TextField
            label="Current balance"
            value={accountBalance}
            onChangeText={setAccountBalance}
            placeholder="₹ amount"
            keyboardType="decimal-pad"
          />
          <Pressable
            accessibilityRole="button"
            onPress={() => void saveAccount()}
            disabled={!api.canWrite || !accountName.trim()}
            className="rounded-md bg-primary py-3 disabled:opacity-50"
          >
            <Text className="text-center text-primary-foreground">Add account</Text>
          </Pressable>
          {api.accounts.map((account) => (
            <View
              key={account.id}
              className="flex-row items-center justify-between border-t border-border/60 pt-2"
            >
              <View>
                <Text className="text-foreground">{account.name}</Text>
                <Text className="text-caption text-foreground-muted">
                  {account.type} · ₹{account.currentBalance.toLocaleString('en-IN')}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  account.id &&
                  Alert.alert('Delete account?', `Remove ${account.name}?`, [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Delete',
                      style: 'destructive',
                      onPress: () => void api.deleteAccount(account.id!),
                    },
                  ])
                }
              >
                <Text className="text-loss">Delete</Text>
              </Pressable>
            </View>
          ))}
        </Collapsible>
      </Card>
      <Card>
        <Collapsible title="Categories" count={api.categories.length}>
          <TextField
            label="Name"
            value={categoryName}
            onChangeText={setCategoryName}
            placeholder="Category name"
          />
          <Segmented
            label="Kind"
            value={categoryKind}
            options={[
              { value: 'expense', label: 'Expense' },
              { value: 'income', label: 'Income' },
            ]}
            onChange={setCategoryKind}
          />
          <Pressable
            accessibilityRole="button"
            onPress={() => void saveCategory()}
            disabled={!api.canWrite || !categoryName.trim()}
            className="rounded-md bg-primary py-3 disabled:opacity-50"
          >
            <Text className="text-center text-primary-foreground">Add category</Text>
          </Pressable>
          {api.categories.map((category) => (
            <View
              key={category.id}
              className="flex-row items-center justify-between border-t border-border/60 pt-2"
            >
              <View>
                <Text className="text-foreground">{category.name}</Text>
                <Text className="text-caption text-foreground-muted">{category.kind}</Text>
              </View>
              {!category.isSystem ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    category.id &&
                    Alert.alert('Delete category?', `Remove ${category.name}?`, [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Delete',
                        style: 'destructive',
                        onPress: () => void api.deleteCategory(category.id!),
                      },
                    ])
                  }
                >
                  <Text className="text-loss">Delete</Text>
                </Pressable>
              ) : null}
            </View>
          ))}
        </Collapsible>
      </Card>
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
        contentContainerClassName="pb-12"
      />
    </SafeAreaView>
  );
}
