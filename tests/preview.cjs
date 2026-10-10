// Isolated UI preview: node tests/preview.cjs (no production data or network writes).
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const seed = {
  bookmarks: Array.from({ length: 12 }, (_, i) => ({
    id: i + 1,
    title: ['デザイン資料', 'プロジェクトノート', 'カレンダー', 'アイデア集', '調べもの', '読みたい記事', '制作ツール', '参考サイト', 'ドキュメント', '学習メモ', 'ニュース', '写真集'][i],
    url: 'http://127.0.0.1:4179/destination?id=' + (i + 1),
    collection: i === 11 ? '' : i % 3 === 0 ? 'Design' : 'Work', tags: i === 11 ? [] : i % 3 === 0 ? ['デザイン', '画像'] : i % 2 ? ['仕事', 'Google'] : ['仕事', '学習'], pinned: i < 8,
    lastUsedAt: Date.now() - i * 1000, useCount: i < 8 ? 5 : 1,
    thumb: 'http://127.0.0.1:4179/thumbnail.svg?i=' + i,
    summary: '表示確認用のサンプルです。サムネイルからページを開き、カードをドラッグして順番を変更できます。',
  })),
  collections: [{ id: 'all', name: 'すべて', icon: '📌' }, { id: 'Work', name: '作業用', icon: '📁' }, { id: 'Design', name: 'クリエイティブ', icon: '🎨' }],
};
const mock = `<script>
const previewKey = 'myraindrop-ui-preview-browse-20261009';
const previewData = JSON.parse(localStorage.getItem(previewKey) || 'null') || ${JSON.stringify(seed)};
const previewDoc = {
  set: async data => { localStorage.setItem(previewKey, JSON.stringify({...data, updatedAt:null})); },
  onSnapshot: callback => callback({exists:true, data:()=>previewData})
};
const previewAuth = {currentUser:null, onAuthStateChanged(callback){this.callback=callback;queueMicrotask(()=>callback(this.currentUser));}, async setPersistence(){}, async signInWithPopup(){this.currentUser={email:'chiharu.murabayashi@gmail.com',emailVerified:true,providerData:[{providerId:'google.com'}]};this.callback(this.currentUser);},async signOut(){this.currentUser=null;this.callback(null);}};
const firebase = {auth:()=>previewAuth,initializeApp(){}, firestore:()=>({collection:()=>({doc:()=>previewDoc})})};
firebase.auth.Auth={Persistence:{SESSION:'session'}};
firebase.auth.GoogleAuthProvider=class {setCustomParameters(){}};
firebase.firestore.FieldValue = {serverTimestamp:()=>null};
</script>`;
http.createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1:4179');
  if (['/extension/classification.js','/extension/auth-config.js','/web-auth.js','/library.js','/browse.js','/browse.css'].includes(url.pathname)) {
    res.setHeader('Content-Type', url.pathname.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    return res.end(fs.readFileSync(path.join(__dirname, '..', url.pathname.slice(1))));
  }
  if (url.pathname === '/thumbnail.svg') {
    const i = Number(url.searchParams.get('i')) || 0;
    const colors = ['#dce7ef', '#e9e3d8', '#dce8dc', '#ebe1ef'];
    res.setHeader('Content-Type', 'image/svg+xml');
    return res.end(`<svg xmlns="http://www.w3.org/2000/svg" width="500" height="${[260,360,210,440][i % 4]}"><rect width="500" height="${[260,360,210,440][i % 4]}" fill="${colors[i % 4]}"/><circle cx="370" cy="80" r="90" fill="white" opacity=".4"/><text x="35" y="180" font-size="84" fill="#555" font-family="sans-serif">${String(i + 1).padStart(2, '0')}</text></svg>`);
  }
  if (url.pathname === '/destination') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.end('<h1>サムネイルリンクの遷移を確認しました</h1>');
  }
  if (url.pathname !== '/') { res.writeHead(404); return res.end(); }
  let html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8')
    .replace(/<script src="https:\/\/www.gstatic.com[^>]+><\/script>/g, '')
    .replace('<!-- Firebase -->', mock)
    .replace("navigator.serviceWorker.register('./sw.js').catch(() => {});", '');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'");
  res.end(html);
}).listen(4179, '127.0.0.1', () => console.log('Isolated UI preview: http://127.0.0.1:4179'));
