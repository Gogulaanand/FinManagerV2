import type { AbstractPowerSyncDatabase } from '@powersync/common';
import { describe, expect, it } from 'vitest';

import {
  mapDeadmanSettingsRows,
  mapEscalationEventRows,
  mapTrustedContactRows,
  saveDeadmanSettings,
  saveTrustedContact,
} from './deadman';

const userId = '22222222-2222-4222-8222-222222222222';
const contactId = '33333333-3333-4333-8333-333333333333';

function fakeDb(selectRows: unknown[] = []) {
  const statements: { sql: string; params: unknown[] }[] = [];
  const db = {
    statements,
    execute: async (sql: string, params: unknown[] = []) => {
      statements.push({ sql, params });
      return sql.startsWith('SELECT') ? { rows: selectRows } : { rows: [] };
    },
    writeTransaction: async <T>(callback: (tx: { execute: typeof db.execute }) => Promise<T>) =>
      callback(db),
  } as unknown as AbstractPowerSyncDatabase & { readonly statements: typeof statements };
  return db;
}

describe('dead-man sync repositories', () => {
  it('updates settings by user id when the row exists', async () => {
    const db = fakeDb([{ id: '44444444-4444-4444-8444-444444444444' }]);
    await saveDeadmanSettings(db, userId, {
      userId,
      isEnabled: true,
      thresholdDays: 30,
      disclosureNote: 'Call my family.',
    });
    expect(db.statements.some((item) => item.sql.startsWith('UPDATE deadman_settings'))).toBe(true);
    expect(db.statements.some((item) => item.sql.startsWith('INSERT INTO deadman_settings'))).toBe(
      false,
    );
  });

  it('inserts and updates trusted contacts with the disclosure scope', async () => {
    const db = fakeDb();
    await saveTrustedContact(db, userId, {
      id: contactId,
      userId,
      name: 'Asha',
      email: 'asha@example.com',
      phone: null,
      relationship: null,
      disclosureScope: 'summary',
      notifyAfterDays: 30,
      priority: 0,
      isActive: true,
    });
    const statement = db.statements.find((item) => item.sql.startsWith('UPDATE trusted_contacts'));
    expect(statement?.params).toContain('summary');
  });

  it('maps JSON event detail and contact defaults', () => {
    expect(
      mapTrustedContactRows([
        { id: contactId, user_id: userId, name: 'Asha', email: 'asha@example.com' },
      ])[0]?.disclosureScope,
    ).toBe('existence');
    expect(
      mapEscalationEventRows([
        {
          id: contactId,
          user_id: userId,
          kind: 'test',
          status: 'sent',
          recipient: 'me@example.com',
          detail: '{"simulation":true}',
          created_at: '2026-07-22T00:00:00.000Z',
          sent_at: null,
        },
      ])[0]?.detail,
    ).toEqual({ simulation: true });
  });

  // Every escalation_events row is written server-side by the deadman-check
  // Edge Function, so it reaches the client as PowerSync's rendering of a
  // Postgres timestamptz: space-separated, with a two-digit UTC offset.
  it('maps rows carrying PowerSync timestamps rather than JavaScript ISO strings', () => {
    const events = mapEscalationEventRows([
      {
        id: contactId,
        user_id: userId,
        kind: 'disclosure',
        status: 'sent',
        recipient: 'asha@example.com',
        detail: '{"scope":"existence"}',
        created_at: '2026-07-24 06:00:58.054782+00',
        sent_at: '2026-07-24 06:00:58.365Z',
      },
    ]);
    expect(events[0]?.kind).toBe('disclosure');
    expect(new Date(events[0]!.createdAt).getTime()).toBe(
      Date.parse('2026-07-24T06:00:58.054782Z'),
    );

    expect(
      mapTrustedContactRows([
        {
          id: contactId,
          user_id: userId,
          name: 'Asha',
          email: 'asha@example.com',
          created_at: '2026-07-24 06:00:58.054782+00',
          updated_at: '2026-07-24 06:00:58.054782+00',
        },
      ])[0]?.name,
    ).toBe('Asha');

    expect(
      mapDeadmanSettingsRows([
        {
          id: contactId,
          user_id: userId,
          is_enabled: 1,
          threshold_days: 30,
          disclosure_note: null,
          created_at: '2026-07-24 06:00:58.054782+00',
          updated_at: '2026-07-24 06:00:58.054782+00',
        },
      ])?.isEnabled,
    ).toBe(true);
  });
});
