import type { SupabaseClient } from '@supabase/supabase-js';

export const PRIVATE_BETA_SIGNUP_MESSAGE =
  'FinManager is currently in a private beta. Request access first, then try again after approval.';

export const PRIVATE_BETA_REQUEST_SUCCESS =
  'Thanks — your request is on file. We will review it for the private beta.';

export const PRIVATE_BETA_REQUEST_ERROR =
  'We could not save that request. Please try again in a moment.';

export function normalizeBetaEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidBetaEmail(value: string): boolean {
  const normalized = normalizeBetaEmail(value);
  return normalized.length <= 320 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalized);
}

export async function submitBetaAccessRequest(
  client: Pick<SupabaseClient, 'rpc'>,
  value: string,
): Promise<{ ok: true } | { ok: false; reason: 'invalid' | 'request-failed' }> {
  if (!isValidBetaEmail(value)) return { ok: false, reason: 'invalid' };

  try {
    const { error } = await client.rpc('request_beta_access', {
      p_email: normalizeBetaEmail(value),
    });
    return error ? { ok: false, reason: 'request-failed' } : { ok: true };
  } catch {
    return { ok: false, reason: 'request-failed' };
  }
}
