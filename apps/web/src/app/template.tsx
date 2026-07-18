import type { ReactNode } from 'react';

import { AnimatedPage } from '@/components/motion/animated-page';

/** Remounts on App Router navigation so each module gets a fresh entrance transition. */
export default function Template({ children }: { children: ReactNode }) {
  return <AnimatedPage>{children}</AnimatedPage>;
}
