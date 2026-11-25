import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // The signed-in app is a client-rendered SPA backed by the Express API and
  // Socket.io, so Cache Components / partial prefetching are left off.
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
};

export default nextConfig;
