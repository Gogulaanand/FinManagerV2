import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';

const icons: Readonly<Record<string, keyof typeof Ionicons.glyphMap>> = {
  home: 'home',
  utensils: 'restaurant',
  'shopping-basket': 'basket',
  zap: 'flash',
  car: 'car',
  'heart-pulse': 'heart',
  shield: 'shield-checkmark',
  'shopping-bag': 'bag-handle',
  clapperboard: 'film',
  'book-open': 'book',
  sparkles: 'sparkles',
  plane: 'airplane',
  landmark: 'business',
  'receipt-text': 'receipt',
  gift: 'gift',
  banknote: 'cash',
  'briefcase-business': 'briefcase',
  percent: 'calculator',
  'chart-no-axes-combined': 'stats-chart',
  'undo-2': 'return-down-back',
  'plus-circle': 'add-circle',
  tag: 'pricetag',
  chart: 'stats-chart',
  gem: 'diamond',
  bitcoin: 'logo-bitcoin',
};

export function CategoryIcon({
  icon,
  color,
  label,
  size = 18,
}: {
  readonly icon: string;
  readonly color: string;
  readonly label?: string;
  readonly size?: number;
}) {
  return (
    <View
      className="size-9 shrink-0 items-center justify-center rounded-full border"
      style={{ borderColor: color, backgroundColor: `${color}1F` }}
      accessible={Boolean(label)}
      accessibilityLabel={label}
    >
      <Ionicons name={icons[icon] ?? 'pricetag'} size={size} color={color} />
    </View>
  );
}
