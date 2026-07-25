'use client';

import { useEffect, useRef, useState } from 'react';
import { buildDisclosureMessage } from '@finmanager/core';
import type { DeadmanSettings, TrustedContact } from '@finmanager/schema';
import { Card, CardHeader, CardLabel, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useDeadman } from '@/lib/deadman';

const blankContact: TrustedContact = {
  name: '',
  email: '',
  phone: null,
  relationship: null,
  disclosureScope: 'existence',
  notifyAfterDays: 30,
  priority: 0,
  isActive: true,
};

export function DeadmanSettingsPanel() {
  const {
    settings,
    contacts,
    events,
    loading,
    canWrite,
    userName,
    summary,
    saveSettings,
    saveContact,
    removeContact,
    invoke,
  } = useDeadman();
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
  const [contact, setContact] = useState<TrustedContact>(blankContact);
  const [message, setMessage] = useState('');
  const [preview, setPreview] = useState<Array<{ recipient: string; scope: string; text: string }>>(
    [],
  );
  const update = (value: Partial<DeadmanSettings>) =>
    setDraft((current) => ({ ...current, ...value }));
  if (!canWrite)
    return (
      <Card>
        <CardTitle>Dead-man switch</CardTitle>
        <CardLabel className="mt-2 block">
          Sign in to configure inactivity reminders and trusted contacts.
        </CardLabel>
      </Card>
    );
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Dead-man switch</CardTitle>
            <CardLabel className="mt-1 block">
              Opening FinManager cancels an escalation. Server checks run daily; an offline device
              is treated as inactive until it syncs.
            </CardLabel>
          </div>
        </CardHeader>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex items-center gap-3 font-body text-body-md">
            <input
              type="checkbox"
              checked={draft.isEnabled}
              onChange={(event) => update({ isEnabled: event.target.checked })}
            />{' '}
            Enable inactivity monitor
          </label>
          <label className="grid gap-1 font-body text-label">
            Threshold days
            <input
              className="h-10 rounded-md border border-border bg-background px-3 text-body-md"
              type="number"
              min={1}
              max={365}
              value={draft.thresholdDays}
              onChange={(event) => update({ thresholdDays: Number(event.target.value) })}
            />
          </label>
        </div>
        <label className="mt-4 grid gap-1 font-body text-label">
          Disclosure note
          <textarea
            className="min-h-24 rounded-md border border-border bg-background p-3 text-body-md"
            maxLength={5000}
            value={draft.disclosureNote ?? ''}
            onChange={(event) => update({ disclosureNote: event.target.value || null })}
            placeholder="A short message included in trusted-contact notices."
          />
        </label>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            onClick={async () => {
              await saveSettings(draft);
              setMessage('Settings saved.');
            }}
          >
            Save settings
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              // Rendered here, from the draft, so it shows what you just typed
              // rather than what has been saved and uploaded. The Edge Function
              // builds the delivered message from the same shared module.
              setPreview(
                contacts
                  .filter((item) => item.isActive && item.email)
                  .map((item) => ({
                    recipient: item.email as string,
                    scope: item.disclosureScope,
                    text: buildDisclosureMessage({
                      userName,
                      scope: item.disclosureScope,
                      note: draft.disclosureNote,
                      summary,
                    }).text,
                  })),
              );
            }}
          >
            Preview notices
          </Button>
          <Button
            variant="outline"
            onClick={async () => {
              await invoke({ action: 'test_send' });
              setMessage('A test notice was sent to your account email.');
            }}
          >
            Test-send to me
          </Button>
        </div>
        {message && <p className="mt-3 font-body text-label text-foreground-muted">{message}</p>}
        {preview.length > 0 && (
          <div className="mt-5 space-y-3">
            <CardTitle className="text-headline-sm">Preview</CardTitle>
            {preview.map((item) => (
              <pre
                key={item.recipient}
                className="whitespace-pre-wrap rounded-md bg-surface-muted p-3 font-body text-label"
              >
                {`${item.recipient} · ${item.scope}\n\n${item.text}`}
              </pre>
            ))}
          </div>
        )}
      </Card>
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Trusted contacts</CardTitle>
            <CardLabel className="mt-1 block">
              Existence shares no amounts. Summary shares only coarse asset-class totals, never
              transactions.
            </CardLabel>
          </div>
        </CardHeader>
        <div className="space-y-3">
          {contacts.map((item) => (
            <div
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-surface-muted p-3"
            >
              <div>
                <p className="font-body font-medium text-foreground">{item.name}</p>
                <p className="font-body text-label text-foreground-muted">
                  {item.email} · {item.disclosureScope}
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setContact(item)}>
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    await removeContact(item.id!);
                  }}
                >
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-5 grid gap-3 border-t border-border pt-5 md:grid-cols-2">
          <label className="grid gap-1 font-body text-label">
            Name
            <input
              className="h-10 rounded-md border border-border bg-background px-3"
              value={contact.name}
              onChange={(event) => setContact({ ...contact, name: event.target.value })}
            />
          </label>
          <label className="grid gap-1 font-body text-label">
            Email
            <input
              className="h-10 rounded-md border border-border bg-background px-3"
              type="email"
              value={contact.email ?? ''}
              onChange={(event) => setContact({ ...contact, email: event.target.value })}
            />
          </label>
          <label className="grid gap-1 font-body text-label">
            Relationship
            <input
              className="h-10 rounded-md border border-border bg-background px-3"
              value={contact.relationship ?? ''}
              onChange={(event) => setContact({ ...contact, relationship: event.target.value })}
            />
          </label>
          <label className="grid gap-1 font-body text-label">
            Disclosure scope
            <select
              className="h-10 rounded-md border border-border bg-background px-3"
              value={contact.disclosureScope}
              onChange={(event) =>
                setContact({
                  ...contact,
                  disclosureScope: event.target.value as TrustedContact['disclosureScope'],
                })
              }
            >
              <option value="existence">Existence only</option>
              <option value="summary">Coarse summary</option>
            </select>
          </label>
          <label className="grid gap-1 font-body text-label">
            Priority
            <input
              className="h-10 rounded-md border border-border bg-background px-3"
              type="number"
              min={0}
              max={100}
              value={contact.priority}
              onChange={(event) => setContact({ ...contact, priority: Number(event.target.value) })}
            />
          </label>
          <label className="flex items-center gap-2 font-body text-label">
            <input
              type="checkbox"
              checked={contact.isActive}
              onChange={(event) => setContact({ ...contact, isActive: event.target.checked })}
            />{' '}
            Active trusted contact
          </label>
        </div>
        <div className="mt-3 flex gap-2">
          <Button
            onClick={async () => {
              await saveContact({
                ...contact,
                email: contact.email || null,
                relationship: contact.relationship || null,
              });
              setContact(blankContact);
            }}
          >
            Save contact
          </Button>
          <Button variant="ghost" onClick={() => setContact(blankContact)}>
            Clear
          </Button>
        </div>
      </Card>
      <Card>
        <CardTitle>Escalation history</CardTitle>
        <div className="mt-3 space-y-2">
          {loading ? (
            <CardLabel>Loading history…</CardLabel>
          ) : events.length === 0 ? (
            <CardLabel>No escalation events yet.</CardLabel>
          ) : (
            events.map((event) => (
              <div
                key={event.id}
                className="flex justify-between gap-3 border-b border-border py-2 font-body text-label"
              >
                <span>
                  {event.kind} · {event.status}
                </span>
                <span className="text-foreground-muted">
                  {event.recipient ?? 'episode'} · {new Date(event.createdAt).toLocaleString()}
                </span>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
