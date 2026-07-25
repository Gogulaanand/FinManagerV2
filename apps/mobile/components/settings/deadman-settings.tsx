import { buildDisclosureMessage, buildSummary } from '@finmanager/core';
import { DeadmanSettingsSchema, type DeadmanSettings } from '@finmanager/schema';
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
} from '@finmanager/sync';
import { usePowerSync, useQuery } from '@powersync/react';
import { useCallback, useMemo, useState } from 'react';
import { router } from 'expo-router';
import { Alert, Pressable, Switch, Text, TextInput, View } from 'react-native';

import { useAuth } from '../providers';
import { Card, CardLabel, CardTitle } from '../card';
import { supabase } from '../../lib/supabase';

function records<T>(rows: readonly T[] | undefined): readonly Record<string, unknown>[] {
  return (rows ?? []) as unknown as readonly Record<string, unknown>[];
}
const inputClass =
  'rounded-md border border-border bg-background px-3 py-2 font-body text-body-md text-foreground';

export function DeadmanSettings() {
  const db = usePowerSync();
  const { session } = useAuth();
  const settingsRows = useQuery<Record<string, unknown>>(DEADMAN_SETTINGS_QUERY);
  const contactRows = useQuery<Record<string, unknown>>(TRUSTED_CONTACTS_QUERY);
  const eventRows = useQuery<Record<string, unknown>>(ESCALATION_EVENTS_QUERY);
  const settings = useMemo(
    () => mapDeadmanSettingsRows(records(settingsRows.data)) ?? DeadmanSettingsSchema.parse({}),
    [settingsRows.data],
  );
  const contacts = useMemo(
    () => mapTrustedContactRows(records(contactRows.data)),
    [contactRows.data],
  );
  const events = useMemo(() => mapEscalationEventRows(records(eventRows.data)), [eventRows.data]);
  // Built on-device so the preview reflects the unsaved draft and still works
  // offline; the server renders the same message from the same module.
  const holdingRows = useQuery<Record<string, unknown>>(DEADMAN_SUMMARY_HOLDINGS_QUERY);
  const accountRows = useQuery<Record<string, unknown>>(DEADMAN_SUMMARY_ACCOUNTS_QUERY);
  const summary = useMemo(
    () =>
      buildSummary(
        records(holdingRows.data).map((row) => ({
          type: String(row.type ?? ''),
          value: Number(row.current_value ?? 0),
        })),
        records(accountRows.data).map((row) => ({
          type: String(row.type ?? ''),
          value: Number(row.current_balance ?? 0),
        })),
      ),
    [holdingRows.data, accountRows.data],
  );
  const [draft, setDraft] = useState<DeadmanSettings>(settings);
  const [notice, setNotice] = useState('');
  const [preview, setPreview] = useState('');
  const saveSettings = useCallback(async () => {
    if (!session) return;
    await saveDeadmanSettings(db, session.user.id, draft);
    setNotice('Settings saved.');
  }, [db, draft, session]);
  const showPreview = useCallback(() => {
    setPreview(
      contacts
        .filter((item) => item.isActive && item.email)
        .map((item) => {
          const message = buildDisclosureMessage({
            userName: session?.user.email ?? 'your FinManager account',
            scope: item.disclosureScope,
            note: draft.disclosureNote,
            summary,
          });
          return `${item.email} · ${item.disclosureScope}\n\n${message.text}`;
        })
        .join('\n\n---\n\n'),
    );
  }, [contacts, draft.disclosureNote, session, summary]);
  const callFunction = useCallback(async (action: string) => {
    const { error } = await supabase.functions.invoke('deadman-check', { body: { action } });
    if (error) Alert.alert('Could not send', error.message);
    else setNotice('Test notice sent to your email.');
  }, []);
  if (!session) return null;
  return (
    <Card>
      <CardTitle>Dead-man switch</CardTitle>
      <CardLabel>
        Opening the app cancels an escalation. Offline activity is treated as inactive until it
        syncs.
      </CardLabel>
      <View className="mt-4 gap-3">
        <View className="flex-row items-center justify-between">
          <Text className="font-body text-body-md text-foreground">Enable inactivity monitor</Text>
          <Switch
            value={draft.isEnabled}
            onValueChange={(value) => setDraft({ ...draft, isEnabled: value })}
          />
        </View>
        <Text className="font-body text-label text-foreground-muted">Threshold days</Text>
        <TextInput
          className={inputClass}
          keyboardType="number-pad"
          value={String(draft.thresholdDays)}
          onChangeText={(value) => setDraft({ ...draft, thresholdDays: Number(value) || 1 })}
        />
        <Text className="font-body text-label text-foreground-muted">Disclosure note</Text>
        <TextInput
          className={`${inputClass} min-h-20`}
          multiline
          value={draft.disclosureNote ?? ''}
          onChangeText={(value) => setDraft({ ...draft, disclosureNote: value || null })}
          placeholder="Message included in notices"
        />
        <View className="flex-row gap-2">
          <Pressable
            className="rounded-md bg-primary px-4 py-3"
            onPress={() => void saveSettings()}
          >
            <Text className="font-body text-body-md text-primary-foreground">Save settings</Text>
          </Pressable>
          <Pressable className="rounded-md bg-surface-muted px-4 py-3" onPress={showPreview}>
            <Text className="font-body text-body-md text-foreground">Preview</Text>
          </Pressable>
          <Pressable
            className="rounded-md bg-surface-muted px-4 py-3"
            onPress={() => void callFunction('test_send')}
          >
            <Text className="font-body text-body-md text-foreground">Test-send</Text>
          </Pressable>
        </View>
        {notice ? <CardLabel>{notice}</CardLabel> : null}
      </View>
      <View className="mt-6 border-t border-border pt-5">
        <CardTitle>Trusted contacts</CardTitle>
        <CardLabel>
          Existence shares no amounts; summary shares coarse asset classes only.
        </CardLabel>
        <Pressable
          className="mt-3 rounded-md bg-primary px-4 py-3"
          onPress={() => router.push('/trusted-contact/new' as never)}
        >
          <Text className="text-center font-body text-body-md text-primary-foreground">
            Add contact in form
          </Text>
        </Pressable>
        <View className="mt-3 gap-2">
          {contacts.map((item) => (
            <View
              key={item.id}
              className="flex-row items-center justify-between rounded-md bg-surface-muted p-3"
            >
              <View>
                <Text className="font-body text-body-md text-foreground">{item.name}</Text>
                <CardLabel>
                  {item.email} · {item.disclosureScope}
                </CardLabel>
              </View>
              <View className="flex-row gap-2">
                <Pressable onPress={() => router.push(`/trusted-contact/${item.id}` as never)}>
                  <Text className="font-body text-label text-primary">Edit</Text>
                </Pressable>
                <Pressable onPress={() => void deleteTrustedContact(db, session.user.id, item.id!)}>
                  <Text className="font-body text-label text-danger">Remove</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
        {preview ? (
          <Text className="mt-3 font-body text-label text-foreground">{preview}</Text>
        ) : null}
      </View>
      <View className="mt-6 border-t border-border pt-5">
        <CardTitle>History</CardTitle>
        {events.slice(0, 10).map((event) => (
          <View key={event.id} className="flex-row justify-between border-b border-border py-2">
            <CardLabel>
              {event.kind} · {event.status}
            </CardLabel>
            <CardLabel>{event.recipient ?? 'episode'}</CardLabel>
          </View>
        ))}
      </View>
    </Card>
  );
}
