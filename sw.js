const CACHE = 'myraindrop-v2';
const STATIC = ['./manifest.json', './icon.svg'];

// インストール：静的ファイルだけキャッシュ（index.htmlは含めない）
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(STATIC))
      .then(() => self.skipWaiting())
  );
});

// 古いキャッシュを削除して即座に有効化
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // index.html はネットワーク優先（常に最新を取得）
  if (e.request.mode === 'navigate' || url.pathname.endsWith('index.html') || url.pathname.endsWith('/')) {
    e.respondWith(
      fetch(e.request)
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // 静的ファイルはキャッシュ優先
  e.respondWith(
    caches.match(e.request)
      .then(cached => cached || fetch(e.request))
  );
});
