import { createClient } from '@supabase/supabase-js';

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}. See apps/web/e2e/README.md.`);
  return value;
}

const url = requiredEnv('NEXT_PUBLIC_SUPABASE_URL');
const secret = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!secret) throw new Error('Missing SUPABASE_SECRET_KEY (or legacy SUPABASE_SERVICE_ROLE_KEY).');

const email = requiredEnv('E2E_USER_EMAIL').toLowerCase();
const password = requiredEnv('E2E_USER_PASSWORD');
const admin = createClient(url, secret, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});

async function checked(label, promise) {
  const { data, error } = await promise;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

async function findUser() {
  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const user = data.users.find((candidate) => candidate.email?.toLowerCase() === email);
    if (user) return user;
    if (data.users.length < 1000) return null;
  }
}

let user = await findUser();
if (!user) {
  const data = await checked(
    'create E2E user',
    admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: 'FinManager Phase 8.5 E2E' },
    }),
  );
  user = data.user;
} else {
  await checked(
    'refresh E2E user',
    admin.auth.admin.updateUserById(user.id, { password, email_confirm: true }),
  );
}
if (!user) throw new Error('Supabase did not return the E2E user.');

const userId = user.id;
const fixtureTables = [
  'escalation_events',
  'deadman_settings',
  'ai_summaries',
  'ai_usage',
  'budgets',
  'transactions',
  'valuations',
  'holding_events',
  'goals',
  'fire_settings',
  'holdings',
  'accounts',
  'tax_scenarios',
  'activity_log',
  'trusted_contacts',
];
for (const table of fixtureTables) {
  await checked(`clear ${table}`, admin.from(table).delete().eq('user_id', userId));
}
await checked(
  'clear E2E categories',
  admin.from('categories').delete().eq('user_id', userId).like('name', 'E2E %'),
);

const existingCategories = await checked(
  'load categories',
  admin.from('categories').select('id,name,kind').eq('user_id', userId),
);
async function category(name, kind, icon, color, isSystem = true) {
  const existing = existingCategories.find(
    (item) => item.name.toLowerCase() === name.toLowerCase() && item.kind === kind,
  );
  if (existing) return existing.id;
  const rows = await checked(
    `create ${name} category`,
    admin
      .from('categories')
      .insert({
        user_id: userId,
        name,
        kind,
        icon,
        color,
        is_system: isSystem,
      })
      .select('id'),
  );
  return rows[0].id;
}

const foodId = await category('Food & Dining', 'expense', 'utensils', '#f97316');
const salaryId = await category('Salary', 'income', 'banknote', '#047857');
const legacyId = await category('E2E Legacy custom', 'expense', 'unknown-legacy', null, false);
await category('E2E Imported category', 'expense', 'tag', '#0F766E', false);

const accountId = crypto.randomUUID();
await checked(
  'seed account',
  admin.from('accounts').insert({
    id: accountId,
    user_id: userId,
    name: 'E2E Salary Account',
    type: 'bank',
    institution: 'Fixture Bank',
    current_balance: 80000,
  }),
);

const now = new Date();
const year = now.getUTCFullYear();
const month = now.getUTCMonth();
const dateFor = (day) =>
  new Date(Date.UTC(year, month, Math.min(day, 28))).toISOString().slice(0, 10);
await checked(
  'seed transactions',
  admin.from('transactions').insert([
    {
      user_id: userId,
      account_id: accountId,
      category_id: foodId,
      amount: 7200,
      direction: 'debit',
      occurred_on: dateFor(4),
      merchant: 'E2E Groceries',
      import_hash: 'phase85-food',
    },
    {
      user_id: userId,
      account_id: accountId,
      category_id: legacyId,
      amount: 900,
      direction: 'debit',
      occurred_on: dateFor(8),
      merchant: 'E2E Pet care',
      import_hash: 'phase85-legacy',
    },
    {
      user_id: userId,
      account_id: accountId,
      category_id: salaryId,
      amount: 150000,
      direction: 'credit',
      occurred_on: dateFor(1),
      merchant: 'E2E Salary',
      import_hash: 'phase85-salary',
    },
  ]),
);
await checked(
  'seed budget',
  admin.from('budgets').insert({
    user_id: userId,
    category_id: foodId,
    period: 'monthly',
    period_start: dateFor(1),
    amount: 6000,
  }),
);

const holdings = [
  {
    id: crypto.randomUUID(),
    user_id: userId,
    name: 'E2E Index Fund',
    type: 'mutual_fund',
    currency: 'INR',
    quantity: 100,
    avg_cost: 1000,
    current_value: 110000,
  },
  {
    id: crypto.randomUUID(),
    user_id: userId,
    name: 'E2E Gold',
    type: 'gold',
    currency: 'INR',
    quantity: 1,
    avg_cost: 40000,
    current_value: 50000,
  },
];
await checked('seed holdings', admin.from('holdings').insert(holdings));

await checked(
  'seed saved monthly summary',
  admin.from('ai_summaries').insert({
    user_id: userId,
    month: now.toISOString().slice(0, 7),
    scope: 'everything',
    content: 'Income covers spending, while the food budget needs attention this month.',
  }),
);
await checked(
  'seed exhausted AI allowance',
  admin.from('ai_usage').insert({
    user_id: userId,
    month: now.toISOString().slice(0, 7),
    input_tokens: 1000000,
    output_tokens: 0,
    request_count: 1,
  }),
);
await checked(
  'seed dead-man settings',
  admin.from('deadman_settings').insert({
    user_id: userId,
    is_enabled: true,
    threshold_days: 30,
    disclosure_note: 'Please contact my family before taking any action.',
  }),
);
await checked(
  'seed trusted contact',
  admin.from('trusted_contacts').insert({
    user_id: userId,
    name: 'E2E Trusted Contact',
    email: 'trusted@example.com',
    relationship: 'Family',
    disclosure_scope: 'summary',
    priority: 0,
    is_active: true,
  }),
);

console.log(`Seeded deterministic Phase 8.5 fixture for ${email} (${userId}).`);
