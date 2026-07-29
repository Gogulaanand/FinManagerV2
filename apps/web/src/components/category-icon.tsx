import {
  Banknote,
  Bitcoin,
  BookOpen,
  BriefcaseBusiness,
  Car,
  ChartNoAxesCombined,
  Clapperboard,
  Gem,
  Gift,
  HeartPulse,
  Home,
  Landmark,
  Percent,
  Plane,
  PlusCircle,
  ReceiptText,
  Shield,
  ShoppingBag,
  ShoppingBasket,
  Sparkles,
  Tag,
  Undo2,
  Utensils,
  Zap,
  type LucideIcon,
} from 'lucide-react';

const icons: Readonly<Record<string, LucideIcon>> = {
  home: Home,
  utensils: Utensils,
  'shopping-basket': ShoppingBasket,
  zap: Zap,
  car: Car,
  'heart-pulse': HeartPulse,
  shield: Shield,
  'shopping-bag': ShoppingBag,
  clapperboard: Clapperboard,
  'book-open': BookOpen,
  sparkles: Sparkles,
  plane: Plane,
  landmark: Landmark,
  'receipt-text': ReceiptText,
  gift: Gift,
  banknote: Banknote,
  'briefcase-business': BriefcaseBusiness,
  percent: Percent,
  'chart-no-axes-combined': ChartNoAxesCombined,
  'undo-2': Undo2,
  'plus-circle': PlusCircle,
  tag: Tag,
  chart: ChartNoAxesCombined,
  gem: Gem,
  bitcoin: Bitcoin,
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
  const Icon = icons[icon] ?? Tag;
  return (
    <span
      className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border"
      style={{
        color,
        borderColor: `color-mix(in srgb, ${color} 35%, transparent)`,
        backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)`,
      }}
      title={label}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <Icon size={size} strokeWidth={2} />
    </span>
  );
}
