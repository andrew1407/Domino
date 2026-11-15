import { assetPath } from './tools';

/**
 * Registers the service worker that keeps the app available without a connection
 * (production builds only: in development a worker would serve stale code).
 */
export const registerServiceWorker = () => {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  const sw = navigator.serviceWorker;
  if (process.env.NODE_ENV !== 'production') {
    sw.getRegistrations?.()
      .then(registrations => registrations.forEach(r => r.unregister()))
      .catch(() => {});
    return;
  }
  const controlled = !!sw.controller;
  sw.register(assetPath('/sw.js'), { scope: assetPath('/') })
    .then(registration => {
      // an already installed worker refreshes its copy: picks up a new deploy
      if (controlled && navigator.onLine) registration.active?.postMessage('precache');
    })
    .catch(() => {
      // offline support is optional
    });
};

export const isOnline = () => typeof navigator === 'undefined' || navigator.onLine !== false;
