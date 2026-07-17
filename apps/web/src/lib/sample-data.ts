/**
 * Sample figures for the Phase 1 shell.
 *
 * There is no data layer until Phase 3 (auth + offline-first sync), so the
 * shell renders fixed numbers to prove typography, alignment, and the money
 * semantics. Every consumer of this module gets deleted or rewired in Phase 3;
 * nothing here should outlive it.
 */

export interface Transaction {
  id: string;
  merchant: string;
  category: string;
  when: string;
  /** Rupees. Negative is a debit. */
  amount: number;
}

export const netWorth = 1245678;
export const netWorthDelta = 0.024;

export const monthSpend = 48320;
export const monthSpendDelta = -0.12;

export const invested = 810000;
export const taxLiability = 112400;

export const fireProgress = 0.34;
export const fireCurrent = 17000000;
export const fireTarget = 50000000;

export const transactions: readonly Transaction[] = [
  {
    id: 't1',
    merchant: 'Swiggy Instamart',
    category: 'Food',
    when: 'Today, 2:45 PM',
    amount: -840,
  },
  { id: 't2', merchant: 'Salary Credit', category: 'Income', when: 'Yesterday', amount: 145000 },
  { id: 't3', merchant: 'Uber Rides', category: 'Transport', when: 'Yesterday', amount: -450 },
  { id: 't4', merchant: 'Amazon India', category: 'Shopping', when: '12 Jul', amount: -4299 },
  { id: 't5', merchant: 'Electricity Bill', category: 'Utilities', when: '10 Jul', amount: -1850 },
];
