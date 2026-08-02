import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, CardTitle } from '../components/card';
import { useAuth } from '../components/providers';

type Mode = 'signin' | 'signup';

export default function LoginScreen() {
  const router = useRouter();
  const { session, signInWithPassword, signInWithGoogle, signUpWithPassword, authTransitionError } =
    useAuth();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Once a session exists, leave the login screen.
  useEffect(() => {
    if (session) router.back();
  }, [session, router]);

  const canSubmit = email.trim().length > 0 && password.length >= 6 && !busy;

  async function submit() {
    if (!canSubmit) return;
    setError(null);
    setNotice(null);
    setBusy(true);
    if (mode === 'signup') {
      const { error: signUpError, needsConfirmation } = await signUpWithPassword(
        email.trim(),
        password,
      );
      setBusy(false);
      if (signUpError) {
        setError(signUpError);
        return;
      }
      // Only promise an email when one was actually sent; otherwise the session
      // already exists and the user is signed in.
      if (needsConfirmation)
        setNotice('Account created. Check your inbox to confirm your email address.');
      return;
    }
    const message = await signInWithPassword(email.trim(), password);
    setBusy(false);
    if (message) setError(message);
  }

  async function submitGoogle() {
    setError(null);
    setNotice(null);
    setBusy(true);
    const message = await signInWithGoogle();
    setBusy(false);
    if (message) setError(message);
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView contentContainerClassName="gap-6 p-4" keyboardShouldPersistTaps="handled">
        <View className="gap-1">
          <Text className="font-display text-headline-lg text-foreground">
            {mode === 'signin' ? 'Welcome back' : 'Create your account'}
          </Text>
          <Text className="font-body text-body-md text-foreground-muted">
            Sign in to sync your finances across web and mobile.
          </Text>
        </View>

        <Card className="gap-4">
          <CardTitle>{mode === 'signin' ? 'Sign in' : 'Sign up'}</CardTitle>

          <View className="gap-1.5">
            <Text className="font-body text-label font-medium text-foreground">Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              placeholder="you@example.com"
              className="h-11 rounded-md border border-border bg-background px-3 font-body text-body-md text-foreground"
            />
          </View>

          <View className="gap-1.5">
            <Text className="font-body text-label font-medium text-foreground">Password</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              placeholder="At least 6 characters"
              className="h-11 rounded-md border border-border bg-background px-3 font-body text-body-md text-foreground"
              onSubmitEditing={submit}
            />
          </View>

          {(error ?? authTransitionError) ? (
            <Text className="font-body text-caption text-loss">{error ?? authTransitionError}</Text>
          ) : null}
          {notice ? (
            <Text className="font-body text-caption text-foreground-muted">{notice}</Text>
          ) : null}

          <Pressable
            onPress={submit}
            disabled={!canSubmit}
            accessibilityRole="button"
            className={`h-11 justify-center rounded-md px-4 ${canSubmit ? 'bg-primary' : 'bg-surface-muted'}`}
          >
            <Text
              className={`text-center font-body text-body-md ${canSubmit ? 'text-primary-foreground' : 'text-foreground-muted'}`}
            >
              {busy ? 'Working…' : mode === 'signin' ? 'Sign in' : 'Create account'}
            </Text>
          </Pressable>

          {mode === 'signin' ? (
            <Pressable
              onPress={() => void submitGoogle()}
              disabled={busy}
              accessibilityRole="button"
              className="h-11 justify-center rounded-md border border-border px-4"
            >
              <Text className="text-center font-body text-body-md text-foreground">
                Continue with Google
              </Text>
            </Pressable>
          ) : null}
        </Card>

        <Pressable
          onPress={() => {
            setMode(mode === 'signin' ? 'signup' : 'signin');
            setError(null);
            setNotice(null);
          }}
          accessibilityRole="button"
        >
          <Text className="text-center font-body text-caption text-foreground-muted">
            {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
            <Text className="font-medium text-primary">
              {mode === 'signin' ? 'Sign up' : 'Sign in'}
            </Text>
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
