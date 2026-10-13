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
  // Lo standalone serve solo all'immagine Docker (Linux). Su Windows crea
  // symlink che il sistema vieta senza Modalita' sviluppatore, e `pnpm build`
  // falliva sempre su "Collecting build traces" (EPERM). Sul PC lo si salta;
  // NEXT_STANDALONE=1 lo forza anche li', se mai servisse.
  ...(process.platform !== 'win32' || process.env.NEXT_STANDALONE === '1'
    ? { output: 'standalone' }
    : {}),
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
