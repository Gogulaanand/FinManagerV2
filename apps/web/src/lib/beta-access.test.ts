import { describe, expect, it, vi } from 'vitest';

import { isValidBetaEmail, normalizeBetaEmail, submitBetaAccessRequest } from './beta-access';

describe('private beta access helpers', () => {
  it('normalizes email input for the database identity', () => {
    expect(normalizeBetaEmail('  PERSON@Example.COM ')).toBe('person@example.com');
  });

  it('accepts ordinary email addresses and rejects malformed input', () => {
    expect(isValidBetaEmail('person@example.com')).toBe(true);
    expect(isValidBetaEmail('person@example')).toBe(false);
    expect(isValidBetaEmail('person@example.com ')).toBe(true);
    expect(isValidBetaEmail('person@@example.com')).toBe(false);
  });

  it('validates before calling the RPC and returns a generic success result', async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    const client = { rpc };

    await expect(submitBetaAccessRequest(client, '  PERSON@Example.COM ')).resolves.toEqual({
      ok: true,
    });
    expect(rpc).toHaveBeenCalledWith('request_beta_access', { p_email: 'person@example.com' });

    await expect(submitBetaAccessRequest(client, 'not-an-email')).resolves.toEqual({
      ok: false,
      reason: 'invalid',
    });
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it('hides RPC failures behind a non-enumerating failure result', async () => {
    const client = { rpc: vi.fn().mockResolvedValue({ error: new Error('row exists') }) };

    await expect(submitBetaAccessRequest(client, 'person@example.com')).resolves.toEqual({
      ok: false,
      reason: 'request-failed',
    });
  });
});
