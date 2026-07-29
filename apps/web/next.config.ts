import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  // PowerSync's wa-sqlite worker imports .wasm; let it resolve as an asset
  // rather than being picked up by Next's static image handling. Turbopack
  // (Next 16 default) needs no extra config beyond an explicit empty block.
  images: {
    disableStaticImages: true,
  },
  turbopack: {},
};

export default withSentryConfig(nextConfig, {
  ...(process.env.SENTRY_ORG ? { org: process.env.SENTRY_ORG } : {}),
  ...(process.env.SENTRY_PROJECT ? { project: process.env.SENTRY_PROJECT } : {}),
  ...(process.env.SENTRY_AUTH_TOKEN ? { authToken: process.env.SENTRY_AUTH_TOKEN } : {}),
  silent: !process.env.CI,
  widenClientFileUpload: true,
  telemetry: false,
});
