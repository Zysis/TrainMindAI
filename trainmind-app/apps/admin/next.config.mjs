/**
 * Console di amministrazione — non ha basePath: vive su un sottodominio
 * suo (admin.trainmind-app.com), non sotto /app come la web app clienti.
 *
 * Nessun `transpilePackages`: questa app NON dipende da @trainmind/db ne'
 * da @trainmind/ui. Parla con Postgres via `pg` e SQL grezzo, di proposito —
 * vedi src/lib/db.ts per il perche'.
 */
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
