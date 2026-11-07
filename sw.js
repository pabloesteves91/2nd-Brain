// Service Worker: App-Shell offline verfügbar machen.
const CACHE = '2nd-brain-v11';
const SHELL = [
  './', 'index.html', 'styles.css', 'manifest.webmanifest',
  'js/app.js', 'js/db.js', 'js/editor.js', 'js/images.js', 'js/ui.js',
  'js/settings.js', 'js/settings-view.js', 'js/review.js', 'js/all.js', 'js/sync.js', 'js/config.js', 'js/native.js', 'js/swipe.js', 'js/tags.js', 'js/tasks.js', 'js/lock.js', 'js/compose.js', 'js/onboarding.js',
  'onboarding/01.jpg', 'onboarding/02.jpg', 'onboarding/03.jpg', 'onboarding/04.jpg', 'onboarding/05.jpg', 'onboarding/06.jpg', 'onboarding/07.jpg',
  'icons/favicon.png', 'icons/mark.png', 'icons/icon-maskable-512.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Eigene Dateien: Netz zuerst (immer aktuell), offline aus dem Cache.
// Firebase-SDK vom CDN: Cache zuerst (versioniert, ändert sich nie).
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === location.origin;
  const sdk = url.hostname === 'www.gstatic.com' && url.pathname.startsWith('/firebasejs/');
  if (!sameOrigin && !sdk) return;

  if (sdk) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy));
      return res;
    })));
    return;
  }

  e.respondWith(fetch(req).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req, { ignoreSearch: true }).then(hit => hit || caches.match('index.html'))));
});
