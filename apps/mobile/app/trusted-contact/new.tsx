import { saveTrustedContact } from '@finmanager/sync';
import type { TrustedContact } from '@finmanager/schema';
import { usePowerSync } from '@powersync/react';
import { router } from 'expo-router';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../../components/providers';
import { TrustedContactForm } from '../../components/settings/trusted-contact-form';
import { setNotice } from '../../lib/notice';

export default function NewTrustedContactRoute() {
  const db = usePowerSync();
  const { session } = useAuth();
  if (!session) return null;
  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView contentContainerClassName="gap-4 p-4 pb-12">
        <TrustedContactForm
          onCancel={() => router.back()}
          onSave={async (contact: TrustedContact) => {
            await saveTrustedContact(db, session.user.id, contact);
            setNotice('Trusted contact saved locally.');
            router.back();
          }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
