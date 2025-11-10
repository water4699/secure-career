/** @type {import('next').NextConfig} */
const nextConfig = {
  // Remove outputFileTracingRoot for Vercel compatibility
  // outputFileTracingRoot: require('path').join(__dirname, '../../'),
  output: 'standalone', // Enable standalone output for better Vercel compatibility
  async headers() {
    return [
      {
        // Match all routes
        source: '/(.*)',
        headers: [
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'unsafe-none',
          },
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'unsafe-none',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
