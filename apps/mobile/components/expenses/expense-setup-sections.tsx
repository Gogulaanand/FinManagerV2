import type { Account, Category } from '@finmanager/schema';
import { resolveCategoryPresentation } from '@finmanager/core';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';

import { Card } from '../card';
import { CategoryIcon } from '../category-icon';
import { Collapsible } from '../collapsible';
import { Field, Segmented } from '../field';
import type { ExpensesApi } from '../../lib/expenses';

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

export function ExpenseSetupSections({
  api,
  accountName,
  accountType,
  accountBalance,
  categoryName,
  categoryKind,
  setAccountName,
  setAccountType,
  setAccountBalance,
  setCategoryName,
  setCategoryKind,
  saveAccount,
  saveCategory,
}: {
  readonly api: ExpensesApi;
  readonly accountName: string;
  readonly accountType: Account['type'];
  readonly accountBalance: string;
  readonly categoryName: string;
  readonly categoryKind: Category['kind'];
  readonly setAccountName: (value: string) => void;
  readonly setAccountType: (value: Account['type']) => void;
  readonly setAccountBalance: (value: string) => void;
  readonly setCategoryName: (value: string) => void;
  readonly setCategoryKind: (value: Category['kind']) => void;
  readonly saveAccount: () => Promise<void>;
  readonly saveCategory: () => Promise<void>;
}): React.JSX.Element {
  return (
    <>
      <Card>
        <Collapsible title="Accounts" count={api.accounts.length}>
          <TextField
            label="Name"
            value={accountName}
            onChangeText={setAccountName}
            placeholder="Bank account"
          />
          <Segmented
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
            onChange={(value) => setCategoryKind(value as Category['kind'])}
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
              className="flex-row items-center gap-3 border-t border-border/60 pt-2"
            >
              <CategoryIcon
                {...resolveCategoryPresentation(category)}
                label={`${category.name} category`}
              />
              <View className="min-w-0 flex-1">
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
    </>
  );
}
