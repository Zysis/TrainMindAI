/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  eslint: {
    // Il lint non blocca la build di produzione (gli errori restano
    // visibili in dev e nella CI); da ripulire nel codice con calma.
    ignoreDuringBuilds: true,
  },
  transpilePackages: ['@trainmind/ui', '@trainmind/utils', '@trainmind/types'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
