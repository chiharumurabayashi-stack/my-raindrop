// オンライン専用。旧バージョンからの移行のため登録を維持する。
// fetch を捕捉せず、HTML・静的ファイルとも通常のネットワーク読み込みに任せる。
self.addEventListener('install', e => {
  e.waitUntil(self.skipWaiting());
});

// このアプリの旧キャッシュだけを削除する。localStorage のデータは保持する。
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k.startsWith('myraindrop-')).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});
