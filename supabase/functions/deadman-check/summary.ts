import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.110.7';
import { HoldingSchema, ValuationSchema } from '../../../packages/schema/src/portfolio.ts';
import { AccountSchema } from '../../../packages/schema/src/expenses.ts';
import { calculatePortfolioSummary } from '../../../packages/core/src/portfolio/analytics.ts';
import { disclosureSummaryFromPortfolio } from '../../../packages/core/src/deadman/messages.ts';

// PostgREST returns typed numeric/boolean/JSON values; strip only database audit columns.
export function domainRow(row: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase()),
      value,
    ]),
  );
}
export async function summaryFor(admin: SupabaseClient, userId: string) {
  const readAll = async (table: string) => {
    const rows: Record<string, unknown>[] = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await admin
        .from(table)
        .select('*')
        .eq('user_id', userId)
        .order('id')
        .range(offset, offset + 499);
      if (error) throw error;
      rows.push(...(data ?? []));
      if (!data || data.length < 500) return rows;
    }
  };
  const [holdings, valuations, accounts] = await Promise.all(
    ['holdings', 'valuations', 'accounts'].map(readAll),
  );
  return disclosureSummaryFromPortfolio(
    calculatePortfolioSummary(
      holdings.map((row) => HoldingSchema.strip().parse(domainRow(row))),
      [], // Disclosure values do not require historical investment cash flows / XIRR.
      valuations.map((row) => ValuationSchema.strip().parse(domainRow(row))),
      accounts.map((row) => AccountSchema.parse(domainRow(row))),
    ),
  );
}
