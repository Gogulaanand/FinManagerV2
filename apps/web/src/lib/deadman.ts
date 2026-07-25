'use client';

import {
  DeadmanSettingsSchema,
  type DeadmanSettings,
  type TrustedContact,
} from '@finmanager/schema';
import { buildSummary } from '@finmanager/core';
import {
  DEADMAN_SETTINGS_QUERY,
  DEADMAN_SUMMARY_ACCOUNTS_QUERY,
  DEADMAN_SUMMARY_HOLDINGS_QUERY,
  ESCALATION_EVENTS_QUERY,
  TRUSTED_CONTACTS_QUERY,
  deleteTrustedContact,
  mapDeadmanSettingsRows,
  mapEscalationEventRows,
  mapTrustedContactRows,
  saveDeadmanSettings,
  saveTrustedContact,
} from '@finmanager/sync';
import { usePowerSync, useQuery } from '@powersync/react';
import { useAuth } from '@/components/providers';
import { supabase } from '@/lib/supabase';
import { useCallback, useMemo } from 'react';

function records<T>(rows: readonly T[] | undefined): readonly Record<string, unknown>[] {
  return (rows ?? []) as unknown as readonly Record<string, unknown>[];
}

export function useDeadman() {
  const db = usePowerSync();
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const settingsResult = useQuery<Record<string, unknown>>(DEADMAN_SETTINGS_QUERY);
  const contactsResult = useQuery<Record<string, unknown>>(TRUSTED_CONTACTS_QUERY);
  const eventsResult = useQuery<Record<string, unknown>>(ESCALATION_EVENTS_QUERY);
  const settings = useMemo(
    () => mapDeadmanSettingsRows(records(settingsResult.data)) ?? DeadmanSettingsSchema.parse({}),
    [settingsResult.data],
  );
  const contacts = useMemo(
    () => mapTrustedContactRows(records(contactsResult.data)),
    [contactsResult.data],
  );
  const events = useMemo(
    () => mapEscalationEventRows(records(eventsResult.data)),
    [eventsResult.data],
  );
  // Built on-device so the preview reflects the unsaved draft and still works
  // offline; the server renders the same message from the same module.
  const holdingsResult = useQuery<Record<string, unknown>>(DEADMAN_SUMMARY_HOLDINGS_QUERY);
  const accountsResult = useQuery<Record<string, unknown>>(DEADMAN_SUMMARY_ACCOUNTS_QUERY);
  const summary = useMemo(
    () =>
      buildSummary(
        records(holdingsResult.data).map((row) => ({
          type: String(row.type ?? ''),
          value: Number(row.current_value ?? 0),
        })),
        records(accountsResult.data).map((row) => ({
          type: String(row.type ?? ''),
          value: Number(row.current_balance ?? 0),
        })),
      ),
    [holdingsResult.data, accountsResult.data],
  );
  const saveSettings = useCallback(
    async (input: DeadmanSettings) => (userId ? saveDeadmanSettings(db, userId, input) : null),
    [db, userId],
  );
  const saveContact = useCallback(
    async (input: TrustedContact) => (userId ? saveTrustedContact(db, userId, input) : null),
    [db, userId],
  );
  const removeContact = useCallback(
    async (id: string) => {
      if (userId) await deleteTrustedContact(db, userId, id);
    },
    [db, userId],
  );
  const invoke = useCallback(async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke('deadman-check', { body });
    if (error) throw error;
    return data as {
      previews?: Array<{
        contactId: string;
        recipient: string;
        scope: string;
        subject: string;
        text: string;
      }>;
    };
  }, []);
  return {
    canWrite: Boolean(userId),
    userName: session?.user.email ?? 'your FinManager account',
    settings,
    contacts,
    events,
    summary,
    loading: [settingsResult.data, contactsResult.data, eventsResult.data].some(
      (value) => value === undefined,
    ),
    saveSettings,
    saveContact,
    removeContact,
    invoke,
  };
}
