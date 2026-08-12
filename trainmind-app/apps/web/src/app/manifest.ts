import type { MetadataRoute } from 'next';
import { withBasePath } from '@/lib/base-path';

/**
 * Manifest della PWA, generato invece che servito da public/.
 *
 * Perché generato: il manifest contiene percorsi assoluti (start_url, scope,
 * icone). Un file statico in public/ li avrebbe scritti dentro fissi, e
 * servendo l'app sotto `/app` sarebbero tutti sbagliati — il browser avrebbe
 * cercato le icone in `/icons/...` invece che in `/app/icons/...` e
 * l'installazione della PWA sarebbe fallita in silenzio. Passandoli da
 * withBasePath() restano corretti in entrambe le configurazioni.
 *
 * Next serve questo file come /manifest.webmanifest (sotto basePath).
 * Sostituisce il precedente public/manifest.json, che è stato rimosso per
 * non lasciare due versioni divergenti dello stesso documento.
 *
 * Nota sui tipi: `share_target` è parte dello standard ma non è ancora nel
 * tipo MetadataRoute.Manifest di Next, da qui il cast finale.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'TrainMind',
    short_name: 'TrainMind',
    // Il manifest non è localizzato: resta nella lingua di default.
    description: 'AI platform for basketball strength and conditioning coaches',
    start_url: withBasePath('/dashboard'),
    scope: withBasePath('/') || '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    theme_color: '#0D3B3B',
    background_color: '#F8FAFC',
    categories: ['sports', 'fitness', 'health'],
    screenshots: [
      {
        src: withBasePath('/icons/screenshot-1.png'),
        sizes: '540x720',
        type: 'image/png',
        form_factor: 'narrow',
      },
      {
        src: withBasePath('/icons/screenshot-2.png'),
        sizes: '1280x720',
        type: 'image/png',
        form_factor: 'wide',
      },
    ],
    icons: [
      {
        src: withBasePath('/icons/icon-192x192.svg'),
        sizes: '192x192',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: withBasePath('/icons/icon-512x512.svg'),
        sizes: '512x512',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: withBasePath('/icons/icon-192x192.png'),
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: withBasePath('/icons/icon-512x512.png'),
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
    shortcuts: [
      {
        name: 'Dashboard',
        short_name: 'Dashboard',
        description: 'Open your dashboard',
        url: withBasePath('/dashboard'),
        icons: [
          {
            src: withBasePath('/icons/icon-192x192.svg'),
            sizes: '192x192',
            type: 'image/svg+xml',
          },
        ],
      },
    ],
    share_target: {
      action: withBasePath('/share'),
      method: 'POST',
      enctype: 'multipart/form-data',
      params: {
        title: 'title',
        text: 'text',
        url: 'url',
        files: [
          {
            name: 'media',
            accept: ['image/png', 'image/jpeg', 'image/webp'],
          },
        ],
      },
    },
  } as unknown as MetadataRoute.Manifest;
}
