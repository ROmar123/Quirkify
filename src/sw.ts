import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { StaleWhileRevalidate, CacheFirst } from 'workbox-strategies';

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: any[] };

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// API responses: network-first with cache fallback
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new StaleWhileRevalidate({ cacheName: 'quirkify-api' })
);

// Images: cache-first (Firebase Storage + Supabase CDN URLs)
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({ cacheName: 'quirkify-images' })
);

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
