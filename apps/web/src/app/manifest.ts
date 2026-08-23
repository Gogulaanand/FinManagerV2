import { light } from '@finmanager/tokens';
import type { MetadataRoute } from 'next';

/**
 * The browser-installable surface is deliberately small: this describes the
 * app shell, but does not imply that the web app supports cold offline use.
 * The manifest has one static canvas color; the viewport metadata in layout.tsx
 * still follows the user's light/dark preference while the app is open.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'FinManager',
    short_name: 'FinManager',
    description: 'A private, family-scale money OS.',
    lang: 'en',
    dir: 'ltr',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    display_override: ['standalone'],
    theme_color: light.background,
    background_color: light.background,
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
