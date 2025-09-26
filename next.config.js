/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // ⚠️ Solo para poder build-ear aunque haya errores de lint
    ignoreDuringBuilds: true,
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:8000/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
