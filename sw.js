const CACHE = 'pa-inspect-v16';
const ASSETS = ['./', './index.html', './manifest.webmanifest'];
// JSZip builds each room's Word file, which may happen with poor signal. Cached separately so a missing file can never stop the app installing.
const OPTIONAL = ['./jszip.min.js', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];
self.addEventListener('install', (event) => { event.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS).then(() => c.addAll(OPTIONAL).catch(() => {}))).then(() => self.skipWaiting())); });
self.addEventListener('activate', (event) => { event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });

// Network-first for the app shell (so updates actually reach installed phones),
// but only for 4 seconds: in weak signal the cached copy opens instead of a
// blank screen. Only good responses are cached, so a captive-portal page or an
// error can never replace the working app.
function cacheIfOk(req, res) {
  if (res && res.ok && res.type === 'basic') {
    const copy = res.clone();
    caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
  }
  return res;
}
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const isShell = req.mode === 'navigate' || url.pathname.endsWith('/index.html') || url.pathname.endsWith('/');
  if (isShell) {
    // The network fetch always runs to the end and refreshes the cache, even
    // when the 4-second race has already served the cached copy — so the next
    // open gets the update.
    const network = fetch(req).then((res) => cacheIfOk(req, res));
    event.waitUntil(network.catch(() => {}));
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 4000));
    event.respondWith(
      Promise.race([network, timeout])
        .then((res) => (res.ok ? res : caches.match(req).then((c) => c || caches.match('./index.html')).then((c) => c || res)))
        .catch(() => caches.match(req).then((cached) => cached || caches.match('./index.html')).then((c) => c || network))
    );
    return;
  }
  // Cache-first for static assets (manifest, icons).
  event.respondWith(caches.match(req).then((cached) => cached || fetch(req).then((res) => cacheIfOk(req, res)).catch(() => caches.match('./index.html'))));
});
