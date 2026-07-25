/**
 * Reads a Supabase API key, preferring the migrated signing-keys format.
 *
 * A project that has rotated to asymmetric JWT signing keys stops accepting the
 * legacy `service_role` and `anon` tokens, which are signed with the retired
 * HS256 secret - Auth rejects them with `unrecognized JWT kid <nil> for
 * algorithm ES256`. During the migration both forms are present and Auth
 * instances pick up the new JWKS at different times, so the failure is
 * intermittent before it becomes permanent.
 *
 * The migrated variables hold a JSON object keyed by name (the default key is
 * `default`), not the plain string the legacy variables held.
 *
 * See https://supabase.com/docs/guides/auth/signing-keys.
 */
export function apiKey(migratedVar: string, legacyVar: string): string | null {
  const migrated = Deno.env.get(migratedVar);
  if (migrated) {
    try {
      const keys = JSON.parse(migrated) as Record<string, string>;
      const key = keys.default ?? Object.values(keys)[0];
      if (typeof key === 'string' && key) return key;
    } catch (error) {
      console.error(`${migratedVar} is not valid JSON; falling back to ${legacyVar}`, error);
    }
  }
  return Deno.env.get(legacyVar) ?? null;
}

/** The service-role key: full access, server-side only. */
export function secretKey(): string | null {
  return apiKey('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY');
}

/** The anon/publishable key, used to verify a caller's own access token. */
export function publishableKey(): string | null {
  return apiKey('SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_ANON_KEY');
}
