import type { TrustedContact } from '@finmanager/schema';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { Card, CardTitle } from '../card';

const inputClass =
  'h-11 rounded-md border border-border bg-background px-3 font-body text-body-md text-foreground';

export function TrustedContactForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: TrustedContact | null;
  onSave: (contact: TrustedContact) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [email, setEmail] = useState(initial?.email ?? '');
  const [relationship, setRelationship] = useState(initial?.relationship ?? '');
  const [scope, setScope] = useState<TrustedContact['disclosureScope']>(
    initial?.disclosureScope ?? 'existence',
  );
  const [priority, setPriority] = useState(String(initial?.priority ?? 0));
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  return (
    <Card>
      <CardTitle>{initial ? 'Edit trusted contact' : 'Add trusted contact'}</CardTitle>
      <View className="mt-4 gap-3">
        <TextInput className={inputClass} placeholder="Name" value={name} onChangeText={setName} />
        <TextInput
          className={inputClass}
          placeholder="Email"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          className={inputClass}
          placeholder="Priority (0 is first)"
          keyboardType="number-pad"
          value={priority}
          onChangeText={setPriority}
        />
        <Pressable
          className="flex-row items-center gap-2"
          onPress={() => setIsActive((value) => !value)}
        >
          <View className={`size-5 rounded border ${isActive ? 'bg-primary' : 'bg-background'}`} />
          <Text className="font-body text-label text-foreground">Active trusted contact</Text>
        </Pressable>
        <TextInput
          className={inputClass}
          placeholder="Relationship"
          value={relationship}
          onChangeText={setRelationship}
        />
        <View className="flex-row gap-2">
          <Pressable
            className={`flex-1 rounded-md px-3 py-3 ${scope === 'existence' ? 'bg-primary' : 'bg-surface-muted'}`}
            onPress={() => setScope('existence')}
          >
            <Text className="text-center font-body text-label text-foreground">Existence only</Text>
          </Pressable>
          <Pressable
            className={`flex-1 rounded-md px-3 py-3 ${scope === 'summary' ? 'bg-primary' : 'bg-surface-muted'}`}
            onPress={() => setScope('summary')}
          >
            <Text className="text-center font-body text-label text-foreground">Coarse summary</Text>
          </Pressable>
        </View>
        <View className="flex-row gap-2">
          <Pressable
            className="flex-1 rounded-md bg-primary px-4 py-3"
            onPress={() =>
              void onSave({
                ...initial,
                name,
                email: email.trim() || null,
                phone: initial?.phone ?? null,
                relationship: relationship.trim() || null,
                disclosureScope: scope,
                notifyAfterDays: initial?.notifyAfterDays ?? 30,
                priority: Number(priority) || 0,
                isActive,
              })
            }
          >
            <Text className="text-center font-body text-body-md text-primary-foreground">Save</Text>
          </Pressable>
          <Pressable className="flex-1 rounded-md bg-surface-muted px-4 py-3" onPress={onCancel}>
            <Text className="text-center font-body text-body-md text-foreground">Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Card>
  );
}
