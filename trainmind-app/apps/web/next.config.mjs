/**
 * Sottopercorso sotto cui l'app viene servita.
 *
 * Vuoto in sviluppo: l'app sta alla radice di localhost:3000, come sempre.
 * In produzione il dominio ospita alla radice il sito vetrina LAB21 e
 * TrainMind vive sotto `/app`: si imposta NEXT_PUBLIC_BASE_PATH=/app come
 * build arg (vedi apps/web/Dockerfile e docker-compose.deploy.yml).
 *
 * `basePath` riscrive le rotte e i <Link>; `assetPrefix` fa lo stesso per i
 * file in /_next. I riferimenti scritti a mano ai file di public/ NON sono
 * coperti: per quelli c'è withBasePath() in src/lib/base-path.ts.
 *
 * La stessa logica sta duplicata in src/lib/base-path.ts perché questo file
 * è un modulo di configurazione caricato fuori dal bundle TypeScript.
 */
const basePath = (() => {
  const raw = process.env.NEXT_PUBLIC_BASE_PATH;
  if (!raw) return '';
  const trimmed = raw.replace(/\/+$/, '');
  if (trimmed === '') return '';
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
})();

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  ...(basePath ? { basePath, assetPrefix: basePath } : {}),
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

  /**
   * Header di sicurezza statici.
   *
   * Nota: la Content-Security-Policy NON sta qui ma in `src/middleware.ts`,
   * perche' richiede un nonce diverso a ogni richiesta e questi header sono
   * invece calcolati una volta sola al build.
   *
   * Prima di questa aggiunta la web app non serviva alcun header di sicurezza:
   * l'helmet configurato in `apps/api/src/app.ts` protegge solo le risposte
   * dell'API (JSON), non le pagine in cui il browser esegue JavaScript.
   */
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // Impedisce di incorporare l'app in un iframe (clickjacking).
          // Ridondante rispetto a frame-ancestors della CSP, ma copre
          // i browser piu' vecchi che non la interpretano.
          { key: 'X-Frame-Options', value: 'DENY' },
          // Blocca il MIME sniffing: un file caricato come immagine non puo'
          // essere reinterpretato come script.
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Non trasmettere il path completo ai siti esterni: gli URL possono
          // contenere identificativi di atleti o token.
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Nessuna di queste API serve all'app.
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
