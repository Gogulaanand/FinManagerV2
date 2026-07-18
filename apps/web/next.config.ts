import type { NextConfig } from 'next';

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

export default nextConfig;
