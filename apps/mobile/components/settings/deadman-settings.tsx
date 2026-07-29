import {
  buildDisclosureMessage,
  buildSummary,
  describeDays,
  STAGE_OFFSETS,
} from '@finmanager/core';
import { DeadmanSettingsSchema, type DeadmanSettings } from '@finmanager/schema';
import { color } from '@finmanager/tokens';
import { Ionicons } from '@expo/vector-icons';
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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { router } from 'expo-router';
import { useColorScheme } from 'nativewind';
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
  const { colorScheme } = useColorScheme();
  const scheme = color[colorScheme === 'dark' ? 'dark' : 'light'];
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
  // useState only captures the first value, and on the first render the
  // PowerSync query has not resolved yet - so `settings` is still the schema
  // default. Without this the form permanently shows defaults, and pressing
  // Save writes them back over the user's real configuration, silently
  // disarming the monitor.
  //
  // Keyed on the row id rather than a loading flag: the query resolves to an
  // empty array before the row syncs down, so a one-shot "loaded" latch would
  // fire against the defaults and never correct itself. A user with no saved
  // row has no id, so the form correctly keeps the defaults.
  const hydratedId = useRef<string | null>(null);
  useEffect(() => {
    if (!settings.id || hydratedId.current === settings.id) return;
    hydratedId.current = settings.id;
    setDraft(settings);
  }, [settings]);
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
    <View className="gap-4">
      <Card className={draft.isEnabled ? 'border-l-4 border-l-primary' : 'border-l-4'}>
        <View className="flex-row items-start gap-3">
          <View
            className={`size-12 items-center justify-center rounded-full ${
              draft.isEnabled ? 'bg-primary/10' : 'bg-surface-muted'
            }`}
          >
            <Ionicons
              name={draft.isEnabled ? 'shield-checkmark' : 'shield-outline'}
              size={25}
              color={draft.isEnabled ? scheme.primary : scheme.foregroundMuted}
            />
          </View>
          <View className="flex-1">
            <CardLabel>Safety status</CardLabel>
            <CardTitle>Monitor {draft.isEnabled ? 'enabled' : 'disabled'}</CardTitle>
            <Text className="mt-1 font-body text-body-md text-foreground-muted">
              {draft.isEnabled
                ? `Reminders begin after ${describeDays(draft.thresholdDays)} without synced activity. Opening FinManager cancels them.`
                : 'No reminders or trusted-contact notices are sent while disabled.'}
            </Text>
          </View>
        </View>
        <View className="mt-4 flex-row gap-3">
          <View className="flex-1 rounded-md bg-surface-muted p-3">
            <Text className="font-display text-headline-sm text-foreground">
              {draft.thresholdDays}
            </Text>
            <CardLabel>day threshold</CardLabel>
          </View>
          <View className="flex-1 rounded-md bg-surface-muted p-3">
            <Text className="font-display text-headline-sm text-foreground">
              {contacts.filter((item) => item.isActive && item.email).length}
            </Text>
            <CardLabel>active contacts</CardLabel>
          </View>
        </View>
      </Card>

      <Card>
        <View className="flex-row items-center gap-3">
          <View className="size-9 items-center justify-center rounded-full bg-primary/10">
            <Ionicons name="time" size={18} color={scheme.primary} />
          </View>
          <View className="flex-1">
            <CardTitle>Inactivity settings</CardTitle>
            <CardLabel>Draft changes stay local until saved.</CardLabel>
          </View>
        </View>
        <View className="mt-4 gap-4">
          <View className="flex-row items-center justify-between rounded-md bg-surface-muted p-3">
            <View className="flex-1 pr-3">
              <Text className="font-body text-body-md text-foreground">
                Enable inactivity monitor
              </Text>
              <CardLabel>Opening the app cancels an escalation.</CardLabel>
            </View>
            <Switch
              value={draft.isEnabled}
              onValueChange={(value) => setDraft({ ...draft, isEnabled: value })}
              trackColor={{ true: scheme.primary }}
            />
          </View>
          <View>
            <Text className="mb-1 font-body text-label text-foreground-muted">
              Inactivity threshold (days)
            </Text>
            <TextInput
              className={inputClass}
              keyboardType="number-pad"
              value={String(draft.thresholdDays)}
              onChangeText={(value) => setDraft({ ...draft, thresholdDays: Number(value) || 1 })}
              accessibilityLabel="Inactivity threshold in days"
            />
          </View>
          <View>
            <Text className="font-body text-label font-semibold text-foreground">
              Escalation timeline
            </Text>
            <View className="mt-2 gap-2">
              {STAGE_OFFSETS.map((item, index) => (
                <View
                  key={item.stage}
                  className="flex-row items-center gap-3 rounded-md border border-border p-3"
                >
                  <View className="size-7 items-center justify-center rounded-full bg-primary/10">
                    <Text className="font-body text-caption font-semibold text-primary">
                      {index + 1}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <Text className="font-body text-label font-semibold text-foreground">
                      {item.stage === 'disclosure'
                        ? 'Trusted-contact notice'
                        : `Reminder ${index + 1}`}
                    </Text>
                    <CardLabel>
                      Day {draft.thresholdDays + item.offset} ·{' '}
                      {item.stage === 'disclosure' ? 'scoped disclosure' : 'sent to you'}
                    </CardLabel>
                  </View>
                </View>
              ))}
            </View>
          </View>
          <View>
            <Text className="mb-1 font-body text-label text-foreground-muted">Disclosure note</Text>
            <TextInput
              className={`${inputClass} min-h-20`}
              multiline
              value={draft.disclosureNote ?? ''}
              onChangeText={(value) => setDraft({ ...draft, disclosureNote: value || null })}
              placeholder="Message included in notices"
              placeholderTextColor={scheme.foregroundMuted}
              accessibilityLabel="Disclosure note"
            />
          </View>
          <View className="flex-row flex-wrap gap-2">
            <Pressable
              className="flex-row items-center gap-2 rounded-md bg-primary px-4 py-3"
              onPress={() => void saveSettings()}
            >
              <Ionicons name="checkmark-circle" size={17} color={scheme.primaryForeground} />
              <Text className="font-body text-body-md text-primary-foreground">Save</Text>
            </Pressable>
            <Pressable
              className="flex-row items-center gap-2 rounded-md bg-surface-muted px-4 py-3"
              onPress={showPreview}
            >
              <Ionicons name="eye" size={17} color={scheme.foreground} />
              <Text className="font-body text-body-md text-foreground">Preview</Text>
            </Pressable>
            <Pressable
              className="flex-row items-center gap-2 rounded-md bg-surface-muted px-4 py-3"
              onPress={() => void callFunction('test_send')}
            >
              <Ionicons name="send" size={17} color={scheme.foreground} />
              <Text className="font-body text-body-md text-foreground">Test-send</Text>
            </Pressable>
          </View>
          {notice ? (
            <View className="flex-row items-center gap-2" accessibilityLiveRegion="polite">
              <Ionicons name="checkmark-circle" size={16} color={scheme.gain} />
              <CardLabel>{notice}</CardLabel>
            </View>
          ) : null}
          {preview ? (
            <View className="rounded-md border border-border bg-surface-muted p-3">
              <View className="mb-2 flex-row items-center gap-2">
                <Ionicons name="eye" size={17} color={scheme.primary} />
                <Text className="font-body text-label font-semibold text-foreground">
                  Local notice preview
                </Text>
              </View>
              <CardLabel>No email is sent by previewing this unsaved draft.</CardLabel>
              <Text className="mt-3 font-body text-label text-foreground">{preview}</Text>
            </View>
          ) : null}
        </View>
      </Card>

      <Card>
        <View className="flex-row items-center gap-3">
          <View className="size-9 items-center justify-center rounded-full bg-primary/10">
            <Ionicons name="people" size={18} color={scheme.primary} />
          </View>
          <View className="flex-1">
            <CardTitle>Trusted contacts</CardTitle>
            <CardLabel>Existence shares no amounts; summary is coarse by asset class.</CardLabel>
          </View>
        </View>
        <Pressable
          className="mt-4 flex-row items-center justify-center gap-2 rounded-md bg-primary px-4 py-3"
          onPress={() => router.push('/trusted-contact/new' as never)}
        >
          <Ionicons name="person-add" size={17} color={scheme.primaryForeground} />
          <Text className="font-body text-body-md text-primary-foreground">
            Add trusted contact
          </Text>
        </Pressable>
        <View className="mt-3 gap-3">
          {contacts.length === 0 ? (
            <View className="items-center rounded-md border border-dashed border-border p-5">
              <Ionicons name="people-outline" size={23} color={scheme.foregroundMuted} />
              <Text className="mt-2 font-body text-body-md text-foreground">
                No trusted contacts yet
              </Text>
              <CardLabel>Add someone to receive a scoped notice after all reminders.</CardLabel>
            </View>
          ) : null}
          {contacts.map((item) => (
            <View key={item.id} className="rounded-md border border-border bg-surface-muted p-3">
              <View className="flex-row items-center gap-3">
                <View className="size-9 items-center justify-center rounded-full bg-background">
                  <Ionicons name="person" size={17} color={scheme.primary} />
                </View>
                <View className="flex-1">
                  <Text className="font-body text-body-md text-foreground">{item.name}</Text>
                  <CardLabel>{item.email}</CardLabel>
                  <View className="mt-1 self-start rounded-full bg-primary/10 px-2 py-0.5">
                    <Text className="font-body text-caption text-primary">
                      {item.disclosureScope === 'summary'
                        ? 'Coarse asset summary'
                        : 'Existence only · no amounts'}
                    </Text>
                  </View>
                </View>
              </View>
              <View className="mt-3 flex-row justify-end gap-4">
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
      </Card>

      <Card>
        <View className="flex-row items-center gap-3">
          <View className="size-9 items-center justify-center rounded-full bg-primary/10">
            <Ionicons name="time" size={18} color={scheme.primary} />
          </View>
          <View>
            <CardTitle>Escalation history</CardTitle>
            <CardLabel>Recent server delivery and reminder events.</CardLabel>
          </View>
        </View>
        {events.length === 0 ? (
          <View className="mt-4">
            <CardLabel>No escalation events yet.</CardLabel>
          </View>
        ) : (
          events.slice(0, 10).map((event) => (
            <View key={event.id} className="border-b border-border py-3">
              <View className="flex-row items-center gap-2">
                <Ionicons
                  name={event.status === 'sent' ? 'checkmark-circle' : 'notifications'}
                  size={16}
                  color={event.status === 'sent' ? scheme.gain : scheme.foregroundMuted}
                />
                <Text className="font-body text-label text-foreground">
                  {event.kind.replaceAll('_', ' ')} · {event.status}
                </Text>
              </View>
              <View className="mt-1">
                <CardLabel>
                  {event.recipient ?? 'Escalation episode'} ·{' '}
                  {new Date(event.createdAt).toLocaleString('en-IN')}
                </CardLabel>
              </View>
            </View>
          ))
        )}
      </Card>
    </View>
  );
}
