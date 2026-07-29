import type { AssetClass } from './analytics.js';

export interface AssetClassPresentation {
  readonly label: string;
  readonly icon: string;
  readonly color: string;
}

const ASSET_CLASS_PRESENTATION: Readonly<Record<AssetClass, AssetClassPresentation>> = {
  equity: { label: 'Equity', icon: 'chart', color: '#0F766E' },
  retirement: { label: 'Retirement', icon: 'shield', color: '#2563EB' },
  fixed_income: { label: 'Fixed income', icon: 'landmark', color: '#7C3AED' },
  real_estate: { label: 'Real estate', icon: 'home', color: '#C2410C' },
  gold: { label: 'Gold', icon: 'gem', color: '#CA8A04' },
  crypto: { label: 'Crypto', icon: 'bitcoin', color: '#9333EA' },
  cash: { label: 'Cash', icon: 'banknote', color: '#047857' },
};

export function assetClassPresentation(assetClass: AssetClass): AssetClassPresentation {
  return ASSET_CLASS_PRESENTATION[assetClass];
}
