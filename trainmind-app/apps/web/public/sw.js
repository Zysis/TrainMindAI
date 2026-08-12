const CACHE_VERSION = 'v2';
const CACHE_NAME = `trainmind-ai-${CACHE_VERSION}`;
const APP_SHELL_CACHE = `app-shell-${CACHE_VERSION}`;
const API_CACHE = `api-cache-${CACHE_VERSION}`;

/**
 * Sottopercorso sotto cui l'app è servita ('' alla radice, '/app' in
 * produzione). Questo file sta in public/ e non passa dal bundler, quindi
 * non può leggere NEXT_PUBLIC_BASE_PATH: il prefisso si ricava dal proprio
 * indirizzo, che è già quello giusto (/sw.js oppure /app/sw.js).
 *
 * La versione della cache è passata a v2 di proposito: i client che hanno
 * in cache le voci con i vecchi percorsi assoluti devono ricostruirla.
 */
const BASE_PATH = new URL(self.location.href).pathname.replace(/\/sw\.js$/, '');
const p = (path) => `${BASE_PATH}${path}`;

// Static assets to cache on install
const STATIC_ASSETS = [
  p('/'),
  p('/offline.html'),
  // Generato da src/app/manifest.ts (prima era public/manifest.json).
  p('/manifest.webmanifest'),
  p('/favicon.svg'),
  p('/favicon.ico'),
  p('/icons/icon-192x192.svg'),
  p('/icons/icon-512x512.svg'),
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  event.waitUntil(
    Promise.all([
      caches.open(APP_SHELL_CACHE).then((cache) => {
        console.log('[Service Worker] Caching app shell assets');
        return cache.addAll(STATIC_ASSETS);
      }),
    ]).then(() => {
      console.log('[Service Worker] Installation complete');
      self.skipWaiting();
    })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (
            cacheName !== CACHE_NAME &&
            cacheName !== APP_SHELL_CACHE &&
            cacheName !== API_CACHE
          ) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[Service Worker] Activation complete');
      return self.clients.claim();
    })
  );
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip chrome extensions and other non-http protocols
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // API calls - Network first, fallback to cache
  if (url.pathname.startsWith(p('/api/'))) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (!response || response.status !== 200 || response.type === 'error') {
            return response;
          }

          // Clone and cache successful responses
          const responseToCache = response.clone();
          caches.open(API_CACHE).then((cache) => {
            cache.put(request, responseToCache);
          });

          return response;
        })
        .catch(() => {
          // Return cached API response if available
          return caches.match(request);
        })
    );
    return;
  }

  // Static assets - Cache first, fallback to network
  if (
    url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|gif|webp|woff|woff2|ttf|eot)$/i) ||
    url.pathname.startsWith(p('/_next/')) ||
    url.pathname.startsWith(p('/icons/'))
  ) {
    event.respondWith(
      caches.match(request).then((response) => {
        if (response) {
          return response;
        }

        return fetch(request).then((response) => {
          if (!response || response.status !== 200 || response.type === 'error') {
            return response;
          }

          const responseToCache = response.clone();
          caches.open(APP_SHELL_CACHE).then((cache) => {
            cache.put(request, responseToCache);
          });

          return response;
        });
      })
    );
    return;
  }

  // HTML pages - Network first, fallback to cache, then offline page
  if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (!response || response.status !== 200) {
            return response;
          }

          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });

          return response;
        })
        .catch(() => {
          return caches.match(request).then((response) => {
            if (response) {
              return response;
            }
            return caches.match(p('/offline.html'));
          });
        })
    );
    return;
  }

  // Default - network first
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (!response || response.status !== 200) {
          return response;
        }

        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, responseToCache);
        });

        return response;
      })
      .catch(() => {
        return caches.match(request);
      })
  );
});

// Message event - for skip waiting and other commands
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
