'use client';

import { useEffect } from 'react';
import { api, isAuthenticated } from '@/lib/api';

export function PwaRegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    navigator.serviceWorker.register('/sw.js').then(async (registration) => {
      console.log('[SW] Registered:', registration.scope);

      // Request push permission if authenticated
      if (isAuthenticated() && 'PushManager' in window) {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
          if (!vapidKey) return;

          try {
            const subscription = await registration.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: urlBase64ToUint8Array(vapidKey),
            });
            // Save subscription to backend
            await api.savePushSubscription(subscription.toJSON());
            console.log('[Push] Subscribed');
          } catch (err) {
            console.warn('[Push] Subscription failed:', err);
          }
        }
      }
    });
  }, []);

  return null;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
