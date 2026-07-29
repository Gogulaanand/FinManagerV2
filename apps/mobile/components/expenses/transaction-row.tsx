import type { Category, Transaction } from '@finmanager/schema';
import { resolveCategoryPresentation } from '@finmanager/core';
import { memo } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Amount } from '../amount';
import { CategoryIcon } from '../category-icon';

export const TransactionRow = memo(function TransactionRow({
  transaction,
  category,
  onEdit,
  onDelete,
}: {
  readonly transaction: Transaction;
  readonly category: Category | undefined;
  readonly onEdit: (transaction: Transaction) => void;
  readonly onDelete: (transaction: Transaction) => void;
}) {
  const signedAmount = transaction.direction === 'debit' ? -transaction.amount : transaction.amount;
  const presentation = resolveCategoryPresentation(category);
  return (
    <View className="mx-4 flex-row items-center gap-2 border-b border-border/60 bg-surface px-4 py-3">
      <CategoryIcon {...presentation} label={`${category?.name ?? 'Uncategorised'} category`} />
      <View className="min-w-0 flex-1">
        <Text numberOfLines={1} className="font-body text-body-md text-foreground">
          {transaction.merchant || transaction.note || 'Transaction'}
        </Text>
        <Text className="font-body text-caption text-foreground-muted">
          {category?.name ?? 'Uncategorised'} · {transaction.occurredOn}
        </Text>
      </View>
      <Amount value={signedAmount} signed />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Edit transaction"
        onPress={() => onEdit(transaction)}
        className="rounded-md bg-surface-muted px-2 py-2"
      >
        <Text className="font-body text-caption text-foreground">Edit</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Delete transaction"
        onPress={() => onDelete(transaction)}
        className="rounded-md bg-surface-muted px-2 py-2"
      >
        <Text className="font-body text-caption text-loss">Delete</Text>
      </Pressable>
    </View>
  );
});
