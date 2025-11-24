/** @type {import('next').NextConfig} */
const nextConfig = {
  // Set outputFileTracingRoot to silence the lockfile warning
  outputFileTracingRoot: require('path').join(__dirname, '../../'),
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
