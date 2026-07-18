'use client';

import dynamic from 'next/dynamic';
import type { ReactNode } from 'react';

const AppProviders = dynamic(() => import('./providers').then((module) => module.AppProviders), {
  ssr: false,
});

export function ClientProviders({ children }: { children: ReactNode }) {
  return <AppProviders>{children}</AppProviders>;
}
