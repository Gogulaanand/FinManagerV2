import {
  LayoutDashboard,
  Receipt,
  Landmark,
  TrendingUp,
  Target,
  Settings,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';

/** The seven top-level modules. Order is deliberate and mirrors mobile navigation. */
export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const navItems: readonly NavItem[] = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/tax', label: 'Tax', icon: Landmark },
  { href: '/expenses', label: 'Expenses', icon: Receipt },
  { href: '/portfolio', label: 'Portfolio', icon: TrendingUp },
  { href: '/insights', label: 'Insights', icon: Sparkles },
  { href: '/goals', label: 'Goals', icon: Target },
  { href: '/settings', label: 'Settings', icon: Settings },
];
