import { Pressable, Text, View } from 'react-native';

export function ChatMessageBubble({
  role,
  content,
  streaming = false,
}: {
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
}) {
  return (
    <View className={role === 'user' ? 'items-end' : 'items-start'}>
      <View
        className={`max-w-[85%] rounded-lg px-4 py-3 ${
          role === 'user' ? 'bg-primary/15' : 'bg-surface-muted'
        }`}
      >
        <Text className="font-body text-body-md text-foreground">
          {content || (streaming ? 'Thinking…' : '')}
        </Text>
      </View>
    </View>
  );
}

export function PromptChip({
  label,
  disabled,
  onPress,
}: {
  label: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      className="rounded-full border border-border bg-surface px-3 py-2 disabled:opacity-50"
    >
      <Text className="font-body text-label text-foreground">{label}</Text>
    </Pressable>
  );
}

export function InsightAction({
  label,
  disabled,
  onPress,
}: {
  label: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      className="min-h-11 items-center justify-center rounded-md bg-primary px-4 disabled:opacity-50"
    >
      <Text className="font-body text-label text-primary-foreground">{label}</Text>
    </Pressable>
  );
}
