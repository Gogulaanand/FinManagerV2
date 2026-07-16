import { roundToPaise } from '@finmanager/core';
import { MoneySchema } from '@finmanager/schema';
import { spacing } from '@finmanager/tokens';
import { StyleSheet, Text, View } from 'react-native';

// Phase 0 placeholder: mirrors apps/web so the shared packages are proven to
// resolve through Metro as well as through the Next bundler.
const sample = MoneySchema.parse({ amount: roundToPaise(123456.789) });

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>FinManager</Text>
      <Text style={styles.subtitle}>Phase 0 - monorepo foundation</Text>
      <Text style={styles.amount}>
        {sample.currency} {sample.amount.toLocaleString('en-IN')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  title: {
    fontSize: 28,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 14,
    opacity: 0.7,
  },
  amount: {
    fontSize: 18,
    fontVariant: ['tabular-nums'],
  },
});
