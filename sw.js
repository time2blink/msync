// Оболочка приложения: сначала сеть (чтобы обновления приходили сразу), без сети — из кэша.
const CACHE = 'msync-shell-v3';
const SHELL = ['./', 'index.html', 'styles.css', 'icon.svg', 'manifest.webmanifest', 'js/core/crypto.js', 'js/core/days.js', 'js/core/features.js', 'js/core/history.js', 'js/core/spring.js', 'js/core/state.js', 'js/core/store.js', 'js/core/sync.js', 'js/ui/app.js'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // запросы к GitHub не трогаем
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('index.html'))));
});
