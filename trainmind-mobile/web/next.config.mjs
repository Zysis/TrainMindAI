/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  transpilePackages: ['@trainmind/ui', '@trainmind/utils', '@trainmind/types'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
  },
  // NOTE: il proxy verso trainmind-app/api e' implementato come catch-all
  // API route in src/app/api/v1/[...path]/route.ts, perche' deve strippare
  // gli header Origin/Host/Referer (la rewrite di Next.js li forwarda
  // intatti e il backend rifiuta CORS).
};

export default nextConfig;
