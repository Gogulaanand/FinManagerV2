/**
 * Fixture figures, retained for manual testing and design work.
 *
 * NOT PRODUCTION DATA. This module was the Phase 1 shell's stand-in before a
 * data layer existed, and the Dashboard kept rendering it long after Phase 3
 * wired everything else to real data - so every user, including brand-new
 * accounts with nothing in them, saw the same invented net worth, spend and
 * transactions on the first screen after sign-in (D-065).
 *
 * Nothing under `app/` may import this. Use it only from throwaway harnesses or
 * design previews, and never to seed a real account.
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
