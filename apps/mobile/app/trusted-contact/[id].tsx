import {
  TRUSTED_CONTACTS_QUERY,
  mapTrustedContactRows,
  saveTrustedContact,
} from '@finmanager/sync';
import type { TrustedContact } from '@finmanager/schema';
import { usePowerSync, useQuery } from '@powersync/react';
import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../../components/providers';
import { TrustedContactForm } from '../../components/settings/trusted-contact-form';
import { setNotice } from '../../lib/notice';

export default function EditTrustedContactRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = usePowerSync();
  const { session } = useAuth();
  const result = useQuery<Record<string, unknown>>(TRUSTED_CONTACTS_QUERY);
  const initial = mapTrustedContactRows(
    (result.data ?? []) as unknown as readonly Record<string, unknown>[],
  ).find((item) => item.id === id);
  if (!session || !initial) return null;
  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView contentContainerClassName="gap-4 p-4 pb-12">
        <TrustedContactForm
          initial={initial}
          onCancel={() => router.back()}
          onSave={async (contact: TrustedContact) => {
            await saveTrustedContact(db, session.user.id, contact);
            setNotice('Trusted contact updated locally.');
            router.back();
          }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
