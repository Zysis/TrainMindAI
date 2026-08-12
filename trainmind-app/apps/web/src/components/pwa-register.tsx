'use client';

import { useEffect, useState } from 'react';
import { usePWA } from '@/hooks/use-pwa';

interface InstallPromptEvent extends Event {
  prompt?: () => Promise<void>;
  userChoice?: Promise<{ outcome: string }>;
}

/**
 * PWA Registration Component
 * Handles:
 * - App installation prompt
 * - Update notifications
 * - iOS install instructions
 */
export function PWARegister() {
  const pwa = usePWA();
  const [installPromptEvent, setInstallPromptEvent] =
    useState<InstallPromptEvent | null>(null);
  const [showUpdateBanner, setShowUpdateBanner] = useState(false);
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);

  useEffect(() => {
    // Listen for install prompt event
    const handleInstallPrompt = (
      e: Event & { detail?: { prompt: InstallPromptEvent } }
    ) => {
      const event = (e as unknown as CustomEvent).detail?.prompt || e;
      setInstallPromptEvent(event as InstallPromptEvent);
    };

    // Listen for update available event
    const handleUpdateAvailable = () => {
      setShowUpdateBanner(true);
    };

    // Show iOS install instructions if not installed
    if (pwa.isIOS && !pwa.isInstalled) {
      const hasSeenIOSPrompt = localStorage.getItem('pwa-ios-prompt-seen');
      if (!hasSeenIOSPrompt) {
        setShowIOSPrompt(true);
        localStorage.setItem('pwa-ios-prompt-seen', 'true');
      }
    }

    window.addEventListener('pwa:install-prompt', handleInstallPrompt);
    window.addEventListener('pwa:update-available', handleUpdateAvailable);

    return () => {
      window.removeEventListener('pwa:install-prompt', handleInstallPrompt);
      window.removeEventListener('pwa:update-available', handleUpdateAvailable);
    };
  }, [pwa.isIOS, pwa.isInstalled]);

  const handleInstall = async () => {
    if (!installPromptEvent) return;

    try {
      if (installPromptEvent.prompt) {
        await installPromptEvent.prompt();
        const { outcome } = await (installPromptEvent.userChoice || Promise.resolve({ outcome: 'dismissed' }));
        console.log('[PWA] Install outcome:', outcome);

        if (outcome === 'accepted') {
          setInstallPromptEvent(null);
        }
      }
    } catch (error) {
      console.error('[PWA] Install error:', error);
    }
  };

  const handleUpdate = () => {
    pwa.skipWaiting();
  };

  const dismissIOSPrompt = () => {
    setShowIOSPrompt(false);
  };

  const dismissUpdateBanner = () => {
    setShowUpdateBanner(false);
  };

  return (
    <>
      {/* Update Banner */}
      {showUpdateBanner && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-teal-600 text-white shadow-lg">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex-1">
                <p className="text-sm font-medium">
                  Una nuova versione di TrainMind è disponibile
                </p>
                <p className="text-xs text-teal-100">
                  Aggiorna per ottenere le ultime funzioni e correzioni
                </p>
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <button
                  onClick={handleUpdate}
                  className="flex-1 sm:flex-none px-4 py-2 bg-white dark:bg-slate-800 text-teal-600 rounded font-medium text-sm hover:bg-teal-50 transition"
                >
                  Aggiorna
                </button>
                <button
                  onClick={dismissUpdateBanner}
                  className="flex-1 sm:flex-none px-4 py-2 bg-teal-700 hover:bg-teal-800 rounded font-medium text-sm transition"
                >
                  Più tardi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* iOS Install Instructions */}
      {showIOSPrompt && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-end sm:items-center justify-center">
          <div className="bg-white dark:bg-slate-800 rounded-t-xl sm:rounded-xl w-full sm:max-w-md sm:mx-4 p-6 shadow-2xl">
            <div className="text-center">
              <h3 className="text-xl font-bold text-teal-900 mb-2">
                Installa TrainMind
              </h3>
              <p className="text-gray-600 text-sm mb-6">
                Aggiungi TrainMind alla schermata iniziale per un accesso più
                veloce e un'esperienza migliore.
              </p>

              <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4 mb-6 text-left">
                <p className="text-xs font-semibold text-gray-700 mb-3">
                  Per installare:
                </p>
                <ol className="text-xs text-gray-600 space-y-2">
                  <li className="flex gap-3">
                    <span className="font-bold text-teal-600 flex-shrink-0">
                      1.
                    </span>
                    <span>
                      Tocca il bottone di condivisione{' '}
                      <span className="font-bold">↑</span>
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="font-bold text-teal-600 flex-shrink-0">
                      2.
                    </span>
                    <span>
                      Scorri verso il basso e tocca "Aggiungi alla schermata
                      iniziale"
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="font-bold text-teal-600 flex-shrink-0">
                      3.
                    </span>
                    <span>Tocca "Aggiungi" in alto a destra</span>
                  </li>
                </ol>
              </div>

              <button
                onClick={dismissIOSPrompt}
                className="w-full px-4 py-3 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 transition"
              >
                Ho capito
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Install Prompt (Android) */}
      {installPromptEvent && !pwa.isIOS && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-end sm:items-center justify-center">
          <div className="bg-white dark:bg-slate-800 rounded-t-xl sm:rounded-xl w-full sm:max-w-md sm:mx-4 p-6 shadow-2xl">
            <div className="text-center">
              <div className="w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-8 h-8 text-teal-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
              </div>

              <h3 className="text-xl font-bold text-teal-900 mb-2">
                Installa TrainMind
              </h3>
              <p className="text-gray-600 text-sm mb-6">
                Installa l'app per un accesso più veloce e un'esperienza offline.
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => setInstallPromptEvent(null)}
                  className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition"
                >
                  Non adesso
                </button>
                <button
                  onClick={handleInstall}
                  className="flex-1 px-4 py-3 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 transition"
                >
                  Installa
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
