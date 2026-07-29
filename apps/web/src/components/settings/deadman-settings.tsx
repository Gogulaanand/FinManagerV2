'use client';

import { useEffect, useRef, useState } from 'react';
import { buildDisclosureMessage, describeDays, STAGE_OFFSETS } from '@finmanager/core';
import type { DeadmanSettings, TrustedContact } from '@finmanager/schema';
import {
  BellRing,
  CheckCircle2,
  Clock3,
  ContactRound,
  Eye,
  History,
  MailCheck,
  Send,
  ShieldCheck,
  ShieldOff,
  Trash2,
  UserRoundPlus,
} from 'lucide-react';
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
      <Card
        className={`overflow-hidden border-l-4 ${
          draft.isEnabled ? 'border-l-primary' : 'border-l-foreground-muted'
        }`}
      >
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
          <div className="flex items-start gap-4">
            <span
              className={`inline-flex size-12 shrink-0 items-center justify-center rounded-full ${
                draft.isEnabled
                  ? 'bg-primary/10 text-primary'
                  : 'bg-surface-muted text-foreground-muted'
              }`}
            >
              {draft.isEnabled ? (
                <ShieldCheck aria-hidden="true" size={25} />
              ) : (
                <ShieldOff aria-hidden="true" size={25} />
              )}
            </span>
            <div>
              <CardLabel>Safety status</CardLabel>
              <h2 className="mt-1 font-display text-headline-md text-foreground">
                Inactivity monitor {draft.isEnabled ? 'enabled' : 'disabled'}
              </h2>
              <p className="mt-1 max-w-2xl font-body text-body-md text-foreground-muted">
                {draft.isEnabled
                  ? `Your reminder sequence starts after ${describeDays(draft.thresholdDays)} without synced activity. Opening FinManager cancels it.`
                  : 'No inactivity reminders or trusted-contact notices will be sent while the monitor is disabled.'}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="rounded-md bg-surface-muted px-4 py-3">
              <p className="font-display text-headline-sm text-foreground">{draft.thresholdDays}</p>
              <p className="font-body text-caption text-foreground-muted">day threshold</p>
            </div>
            <div className="rounded-md bg-surface-muted px-4 py-3">
              <p className="font-display text-headline-sm text-foreground">
                {contacts.filter((item) => item.isActive && item.email).length}
              </p>
              <p className="font-body text-caption text-foreground-muted">active contacts</p>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <span className="inline-flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Clock3 aria-hidden="true" size={18} />
            </span>
            <div>
              <CardTitle>Inactivity settings</CardTitle>
              <CardLabel className="mt-1 block">
                Changes remain local until you save them. Offline activity counts after it syncs.
              </CardLabel>
            </div>
          </div>
        </CardHeader>
        <div className="rounded-md border border-border bg-surface-muted p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-body text-label font-semibold text-foreground">
                Enable inactivity monitor
              </p>
              <CardLabel className="mt-1 block">
                Opening FinManager cancels any active escalation.
              </CardLabel>
            </div>
            <label className="inline-flex cursor-pointer items-center gap-3 font-body text-label">
              <span className="sr-only">Enable inactivity monitor</span>
              <input
                type="checkbox"
                checked={draft.isEnabled}
                onChange={(event) => update({ isEnabled: event.target.checked })}
                className="size-5 accent-primary"
              />
              {draft.isEnabled ? 'Enabled' : 'Disabled'}
            </label>
          </div>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-[12rem_minmax(0,1fr)]">
          <label className="grid gap-1 font-body text-label">
            Inactivity threshold
            <input
              className="h-10 rounded-md border border-border bg-background px-3 text-body-md"
              type="number"
              min={1}
              max={365}
              value={draft.thresholdDays}
              onChange={(event) => update({ thresholdDays: Number(event.target.value) })}
            />
            <span className="text-caption text-foreground-muted">1–365 days</span>
          </label>
          <div>
            <p className="font-body text-label font-semibold text-foreground">
              What happens after the threshold
            </p>
            <ol className="mt-3 grid gap-2 sm:grid-cols-4" aria-label="Escalation timeline">
              {STAGE_OFFSETS.map((item, index) => (
                <li
                  key={item.stage}
                  className="relative rounded-md border border-border bg-background p-3"
                >
                  <div className="flex items-center gap-2">
                    <span className="inline-flex size-6 items-center justify-center rounded-full bg-primary/10 font-body text-caption font-semibold text-primary">
                      {index + 1}
                    </span>
                    <span className="font-body text-caption font-semibold text-foreground">
                      {item.stage === 'disclosure' ? 'Contact notice' : `Reminder ${index + 1}`}
                    </span>
                  </div>
                  <p className="mt-2 font-body text-caption text-foreground-muted">
                    Day {draft.thresholdDays + item.offset}
                    {item.stage === 'disclosure' ? ' · scoped disclosure' : ' · sent to you'}
                  </p>
                </li>
              ))}
            </ol>
          </div>
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
            <CheckCircle2 aria-hidden="true" size={16} />
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
            <Eye aria-hidden="true" size={16} />
            Preview notices
          </Button>
          <Button
            variant="outline"
            onClick={async () => {
              await invoke({ action: 'test_send' });
              setMessage('A test notice was sent to your account email.');
            }}
          >
            <Send aria-hidden="true" size={16} />
            Test-send to me
          </Button>
        </div>
        {message && <p className="mt-3 font-body text-label text-foreground-muted">{message}</p>}
        {preview.length > 0 && (
          <div className="mt-5 space-y-3">
            <div className="flex items-center gap-2">
              <Eye aria-hidden="true" size={18} className="text-primary" />
              <CardTitle className="text-headline-sm">Local notice preview</CardTitle>
            </div>
            <CardLabel>
              Built from the unsaved note above. No email is sent when you preview.
            </CardLabel>
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
          <div className="flex items-start gap-3">
            <span className="inline-flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
              <ContactRound aria-hidden="true" size={18} />
            </span>
            <div>
              <CardTitle>Trusted contacts</CardTitle>
              <CardLabel className="mt-1 block">
                Existence shares no amounts. Summary shares coarse asset-class totals, never
                transactions.
              </CardLabel>
            </div>
          </div>
        </CardHeader>
        <div className="space-y-3">
          {contacts.length === 0 ? (
            <div className="rounded-md border border-dashed border-border p-5 text-center">
              <UserRoundPlus
                aria-hidden="true"
                size={22}
                className="mx-auto text-foreground-muted"
              />
              <p className="mt-2 font-body text-body-md text-foreground">No trusted contacts yet</p>
              <CardLabel className="mt-1 block">
                Add someone who should receive a scoped notice after the reminder sequence.
              </CardLabel>
            </div>
          ) : null}
          {contacts.map((item) => (
            <div
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-surface-muted p-4"
            >
              <div className="flex items-center gap-3">
                <span className="inline-flex size-9 items-center justify-center rounded-full bg-background text-primary">
                  <ContactRound aria-hidden="true" size={17} />
                </span>
                <div>
                  <p className="font-body font-medium text-foreground">{item.name}</p>
                  <p className="font-body text-label text-foreground-muted">{item.email}</p>
                  <span className="mt-1 inline-flex rounded-full bg-primary/10 px-2 py-0.5 font-body text-caption text-primary">
                    {item.disclosureScope === 'summary'
                      ? 'Coarse asset summary'
                      : 'Existence only · no amounts'}
                  </span>
                </div>
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
                  <Trash2 aria-hidden="true" size={15} />
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
            <UserRoundPlus aria-hidden="true" size={16} />
            Save contact
          </Button>
          <Button variant="ghost" onClick={() => setContact(blankContact)}>
            Clear
          </Button>
        </div>
      </Card>
      <Card>
        <div className="flex items-center gap-3">
          <span className="inline-flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
            <History aria-hidden="true" size={18} />
          </span>
          <div>
            <CardTitle>Escalation history</CardTitle>
            <CardLabel className="mt-1 block">
              Delivery and reminder events from the server.
            </CardLabel>
          </div>
        </div>
        <div className="mt-3 space-y-2">
          {loading ? (
            <CardLabel>Loading history…</CardLabel>
          ) : events.length === 0 ? (
            <CardLabel>No escalation events yet.</CardLabel>
          ) : (
            events.map((event) => (
              <div
                key={event.id}
                className="flex flex-col justify-between gap-2 border-b border-border py-3 font-body text-label sm:flex-row sm:items-center"
              >
                <span className="flex items-center gap-2 text-foreground">
                  {event.status === 'sent' ? (
                    <MailCheck aria-hidden="true" size={16} className="text-gain" />
                  ) : (
                    <BellRing aria-hidden="true" size={16} className="text-foreground-muted" />
                  )}
                  {event.kind.replaceAll('_', ' ')} · {event.status}
                </span>
                <span className="text-foreground-muted">
                  {event.recipient ?? 'Escalation episode'} ·{' '}
                  {new Date(event.createdAt).toLocaleString('en-IN')}
                </span>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
