/* Property Assist Inspection — service worker
 * Caches the app shell so the app opens with no signal. Cross-origin calls
 * (the Val Town transcription endpoint, Deepgram) are left untouched so uploads
 * work normally when back online.
 */
const CACHE = 'pa-inspect-v1';
const ASSETS = ['./', './index.html', './manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;                       // never touch POST uploads
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;        // let Val Town / Deepgram pass through

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match('./index.html'));       // offline navigation fallback
    })
  );
});
