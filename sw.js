/* AutoDex service worker — offline shell with self-healing updates. */
const VERSION = 'v1';
const CACHE = `autodex-${VERSION}`;

const SHELL = [
  './', './index.html', './manifest.webmanifest',
  './css/app.css',
  './js/app.js', './js/data.js', './js/store.js',
  './js/catalogue.js', './js/challenges.js',
  './icons/icon-192.png', './icons/icon-512.png',
  './icons/apple-touch-icon.png', './icons/favicon-32.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => Promise.all(
      SHELL.map(url => fetch(new Request(url, { cache: 'reload' }))
        .then(res => (res && res.ok) ? c.put(url, res) : null).catch(() => null))
    )).then(() => self.skipWaiting()).catch(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    const stale = keys.filter(k => k !== CACHE && k.startsWith('autodex-'));
    await Promise.all(stale.map(k => caches.delete(k)));
    await self.clients.claim();
    if (stale.length) {
      self.clients.matchAll({ type: 'window' }).then(list => {
        for (const c of list) {
          try { c.postMessage({ type: 'RELOAD' }); } catch {}
          try { c.navigate(c.url); } catch {}
        }
      }).catch(() => {});
    }
  })());
});

self.addEventListener('message', e => {
  if (!e.data) return;
  if (e.data.type === 'SKIP_WAITING') self.skipWaiting();
  if (e.data.type === 'VERSION') {
    const reply = { type: 'VERSION', version: VERSION };
    if (e.ports && e.ports[0]) e.ports[0].postMessage(reply);
    else if (e.source) e.source.postMessage(reply);
  }
});

function networkFirst(req, ms = 3000) {
  return new Promise(resolve => {
    let done = false;
    const finish = r => { if (!done) { done = true; resolve(r); } };
    const t = setTimeout(() => {
      caches.match(req, { ignoreSearch: true }).then(h => h && finish(h));
    }, ms);
    fetch(req).then(res => {
      clearTimeout(t);
      if (res && res.ok) { const c = res.clone(); caches.open(CACHE).then(x => x.put(req, c)).catch(() => {}); }
      finish(res);
    }).catch(() => {
      clearTimeout(t);
      caches.match(req, { ignoreSearch: true })
        .then(h => finish(h || caches.match('./index.html')));
    });
  });
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== location.origin) return;
  if (req.mode === 'navigate') { e.respondWith(networkFirst(req)); return; }
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(hit => {
      const fresh = fetch(req).then(res => {
        if (res && res.ok && res.type === 'basic') {
          const c = res.clone(); caches.open(CACHE).then(x => x.put(req, c)).catch(() => {});
        }
        return res;
      }).catch(() => null);
      return hit || fresh.then(r => r || caches.match('./index.html'));
    })
  );
});
