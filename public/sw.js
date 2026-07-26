/* DCSS Manager service worker — makes the game installable and playable offline.
   The app is one self-contained HTML, so caching the shell caches the whole game.
   Strategy: stale-while-revalidate for the same-origin shell (instant launch +
   offline), while the app's own version.json checker (which we deliberately let
   hit the network) still detects new builds and prompts a reload. Cross-origin
   requests (Firebase auth/Firestore) pass straight through, untouched. */
const CACHE = 'dcss-shell-v1';
const SHELL = [
  './', './index.html', './manifest.webmanifest',
  './icon-192.png', './icon-512.png', './icon-maskable-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(k => (k === CACHE ? null : caches.delete(k)))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;       // Firebase & friends: network
  if (url.pathname.endsWith('version.json')) return;      // keep auto-update live

  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = (await cache.match(req, { ignoreSearch: true }))
      || (req.mode === 'navigate' ? await cache.match('./index.html') : null);
    const fresh = fetch(req).then(res => {
      if (res && res.ok && res.type === 'basic') cache.put(req, res.clone());
      return res;
    }).catch(() => null);
    return cached || (await fresh) || new Response('offline', { status: 503 });
  })());
});
