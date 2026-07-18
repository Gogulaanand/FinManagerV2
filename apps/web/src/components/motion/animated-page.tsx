'use client';

import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { usePathname } from 'next/navigation';
import { type ReactNode, useRef } from 'react';

gsap.registerPlugin(useGSAP);

export function AnimatedPage({ children }: { children: ReactNode }) {
  const scope = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useGSAP(
    () => {
      const media = gsap.matchMedia();
      media.add({ reduceMotion: '(prefers-reduced-motion: reduce)' }, ({ conditions }) => {
        const reduced = Boolean(conditions?.reduceMotion);
        const cards = gsap.utils.toArray<HTMLElement>('[data-motion-card]', scope.current);
        const progressBars = gsap.utils.toArray<HTMLElement>('[data-motion-progress]', scope.current);

        if (reduced) {
          gsap.set([scope.current, ...cards], { autoAlpha: 1, y: 0, clearProps: 'transform' });
          progressBars.forEach((element) => {
            gsap.set(element, {
              scaleX: Number(element.dataset.progress ?? 1),
              transformOrigin: 'left center',
            });
          });
          return;
        }

        gsap.set(scope.current, { autoAlpha: 0, y: 12 });
        gsap.set(cards, { autoAlpha: 0, y: 16 });
        gsap.set(progressBars, { scaleX: 0, transformOrigin: 'left center' });

        const timeline = gsap.timeline({ defaults: { ease: 'power2.out' } });
        timeline
          .to(scope.current, { autoAlpha: 1, y: 0, duration: 0.45 })
          .to(cards, { autoAlpha: 1, y: 0, duration: 0.5, stagger: 0.08 }, '-=0.2')
          .to(
            progressBars,
            {
              scaleX: (_index, element) => Number((element as HTMLElement).dataset.progress ?? 1),
              duration: 0.75,
              stagger: 0.05,
              ease: 'power2.out',
            },
            '-=0.25',
          );

        return () => {
          timeline.kill();
          gsap.killTweensOf([scope.current, ...cards, ...progressBars]);
          gsap.set([scope.current, ...cards], { clearProps: 'all' });
          gsap.set(progressBars, { clearProps: 'all' });
        };
      }, scope);

      return () => media.revert();
    },
    { dependencies: [pathname], revertOnUpdate: true, scope },
  );

  return (
    <div key={pathname} ref={scope}>
      {children}
    </div>
  );
}
