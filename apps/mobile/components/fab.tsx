import { Ionicons } from '@expo/vector-icons';
import { color } from '@finmanager/tokens';
import { useColorScheme } from 'nativewind';
import { Pressable } from 'react-native';

/**
 * A thumb-reachable floating action button, pinned to the bottom-right above
 * the tab bar. Each tab passes its own icon so the primary create action reads
 * differently per screen (a receipt for expenses, a chart for portfolio, a flag
 * for goals) rather than an identical, ambiguous plus everywhere.
 */
export function Fab({
  icon,
  label,
  onPress,
  disabled = false,
}: {
  readonly icon: keyof typeof Ionicons.glyphMap;
  readonly label: string;
  readonly onPress: () => void;
  readonly disabled?: boolean;
}) {
  const { colorScheme } = useColorScheme();
  const scheme = color[colorScheme === 'dark' ? 'dark' : 'light'];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      // elevation renders the Android shadow; shadow-* covers iOS.
      style={{ elevation: 6 }}
      className="absolute bottom-6 right-5 size-14 items-center justify-center rounded-full bg-primary shadow-lg disabled:opacity-40"
    >
      <Ionicons name={icon} size={26} color={scheme.primaryForeground} />
    </Pressable>
  );
}
