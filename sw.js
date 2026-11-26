// Offline support: keeps a copy of the game on the phone.
// Online: always tries the newest version first (so updates arrive), but gives up after
// a few seconds on a weak signal and uses the saved copy. Offline: uses the saved copy.
const CACHE = 'beepbeep-v4';
const ASSETS = ['./', './index.html', './manifest.webmanifest', './icon-180.png', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const isPage = req.mode === 'navigate';
  const key = isPage ? './index.html' : req;

  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(key, { ignoreSearch: true });
    const network = fetch(req, { cache: 'no-cache' }).then(res => {
      if (res && res.ok) cache.put(key, res.clone());
      return res;
    });
    if (!cached) {
      try { return await network; } catch (err) { return Response.error(); }
    }
    // Have a saved copy: prefer fresh, but don't wait more than 3 seconds for it
    const timeout = new Promise(resolve => setTimeout(() => resolve(null), 3000));
    try {
      const res = await Promise.race([network, timeout]);
      return (res && res.ok) ? res : cached;
    } catch (err) {
      return cached;
    }
  })());
});
