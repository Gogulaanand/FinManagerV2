import type { CategoryKind } from '@finmanager/schema';

export interface DefaultCategory {
  readonly key: string;
  readonly name: string;
  readonly kind: CategoryKind;
  readonly icon: string;
  readonly color: string;
  readonly sortOrder: number;
}

export const DEFAULT_CATEGORIES: readonly DefaultCategory[] = [
  { key: 'rent', name: 'Rent & Housing', kind: 'expense', icon: 'home', color: '#7c3aed', sortOrder: 10 },
  { key: 'food', name: 'Food & Dining', kind: 'expense', icon: 'utensils', color: '#f97316', sortOrder: 20 },
  { key: 'groceries', name: 'Groceries', kind: 'expense', icon: 'shopping-basket', color: '#16a34a', sortOrder: 30 },
  { key: 'utilities', name: 'Utilities', kind: 'expense', icon: 'zap', color: '#2563eb', sortOrder: 40 },
  { key: 'transport', name: 'Transport', kind: 'expense', icon: 'car', color: '#0891b2', sortOrder: 50 },
  { key: 'health', name: 'Health', kind: 'expense', icon: 'heart-pulse', color: '#e11d48', sortOrder: 60 },
  { key: 'insurance', name: 'Insurance', kind: 'expense', icon: 'shield', color: '#0f766e', sortOrder: 70 },
  { key: 'shopping', name: 'Shopping', kind: 'expense', icon: 'shopping-bag', color: '#db2777', sortOrder: 80 },
  { key: 'entertainment', name: 'Entertainment', kind: 'expense', icon: 'clapperboard', color: '#9333ea', sortOrder: 90 },
  { key: 'education', name: 'Education', kind: 'expense', icon: 'book-open', color: '#ca8a04', sortOrder: 100 },
  { key: 'personal-care', name: 'Personal Care', kind: 'expense', icon: 'sparkles', color: '#c026d3', sortOrder: 110 },
  { key: 'travel', name: 'Travel', kind: 'expense', icon: 'plane', color: '#0284c7', sortOrder: 120 },
  { key: 'emi', name: 'EMI & Loans', kind: 'expense', icon: 'landmark', color: '#475569', sortOrder: 130 },
  { key: 'taxes', name: 'Taxes', kind: 'expense', icon: 'receipt-text', color: '#b91c1c', sortOrder: 140 },
  { key: 'gifts', name: 'Gifts & Donations', kind: 'expense', icon: 'gift', color: '#be123c', sortOrder: 150 },
  { key: 'salary', name: 'Salary', kind: 'income', icon: 'banknote', color: '#047857', sortOrder: 210 },
  { key: 'freelance', name: 'Freelance', kind: 'income', icon: 'briefcase-business', color: '#15803d', sortOrder: 220 },
  { key: 'interest', name: 'Interest', kind: 'income', icon: 'percent', color: '#0f766e', sortOrder: 230 },
  { key: 'dividends', name: 'Dividends', kind: 'income', icon: 'chart-no-axes-combined', color: '#166534', sortOrder: 240 },
  { key: 'refunds', name: 'Refunds', kind: 'income', icon: 'undo-2', color: '#65a30d', sortOrder: 250 },
  { key: 'other-income', name: 'Other Income', kind: 'income', icon: 'plus-circle', color: '#15803d', sortOrder: 260 },
];
