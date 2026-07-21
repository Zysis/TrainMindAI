'use client';

import { useEffect, useRef, useState } from 'react';

interface PWAState {
  isInstalled: boolean;
  isIOS: boolean;
  updateAvailable: boolean;
}

/**
 * Custom hook to manage PWA functionality
 * - Registers service worker
 * - Detects if app is installed
 * - Handles update notifications
 * - Detects iOS for install instructions
 */
export function usePWA() {
  const [state, setState] = useState<PWAState>({
    isInstalled: false,
    isIOS: false,
    updateAvailable: false,
  });

  const swRegistrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const updateCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Check if running on iOS
    const isIOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) &&
      !(window as any).MSStream;

    // Check if app is installed (in standalone mode)
    const isInstalled =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;

    setState((prev) => ({
      ...prev,
      isIOS,
      isInstalled,
    }));

    // Register service worker
    const registerServiceWorker = async () => {
      if (!('serviceWorker' in navigator)) {
        console.log('[PWA] Service Workers not supported');
        return;
      }

      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
        });

        swRegistrationRef.current = registration;
        console.log('[PWA] Service Worker registered', registration);

        // Listen for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;

          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (
                newWorker.state === 'installed' &&
                navigator.serviceWorker.controller
              ) {
                console.log('[PWA] Update available');
                setState((prev) => ({
                  ...prev,
                  updateAvailable: true,
                }));

                // Dispatch custom event for update
                const event = new Event('pwa:update-available');
                window.dispatchEvent(event);
              }
            });
          }
        });

        // Check for updates periodically
        updateCheckIntervalRef.current = setInterval(() => {
          registration.update();
        }, 60000); // Check every minute

        return registration;
      } catch (error) {
        console.error('[PWA] Service Worker registration failed:', error);
      }
    };

    registerServiceWorker();

    // Listen for app install prompt
    let deferredPrompt: any;

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      deferredPrompt = e;
      console.log('[PWA] Install prompt available');

      // Dispatch custom event
      const event = new CustomEvent('pwa:install-prompt', {
        detail: { prompt: deferredPrompt },
      });
      window.dispatchEvent(event);
    };

    const handleAppInstalled = () => {
      console.log('[PWA] App installed');
      deferredPrompt = null;
      setState((prev) => ({
        ...prev,
        isInstalled: true,
      }));

      const event = new Event('pwa:installed');
      window.dispatchEvent(event);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // Cleanup
    return () => {
      window.removeEventListener(
        'beforeinstallprompt',
        handleBeforeInstallPrompt
      );
      window.removeEventListener('appinstalled', handleAppInstalled);

      if (updateCheckIntervalRef.current) {
        clearInterval(updateCheckIntervalRef.current);
      }
    };
  }, []);

  const skipWaiting = async () => {
    if (swRegistrationRef.current?.waiting) {
      console.log('[PWA] Skipping waiting service worker');
      swRegistrationRef.current.waiting.postMessage({ type: 'SKIP_WAITING' });

      // Reload page to activate new service worker
      window.location.reload();
    }
  };

  const requestUpdate = async () => {
    if (swRegistrationRef.current) {
      console.log('[PWA] Checking for updates');
      swRegistrationRef.current.update();
    }
  };

  return {
    ...state,
    skipWaiting,
    requestUpdate,
    swRegistration: swRegistrationRef.current,
  };
}
