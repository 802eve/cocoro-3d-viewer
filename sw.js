// ★ COCORO-KOBO Service Worker
// 静的ファイルをキャッシュしてオフライン対応 + 高速化
// バージョンを上げると キャッシュが更新される

const CACHE_VERSION = 'cocoro-v1';
const ASSETS = [
  '/cocoro-3d-viewer/',
  '/cocoro-3d-viewer/index.html',
  '/cocoro-3d-viewer/manifest.json',
  '/cocoro-3d-viewer/icon-192.png',
  '/cocoro-3d-viewer/icon-512.png',
  '/cocoro-3d-viewer/icon-180.png',
  '/cocoro-3d-viewer/favicon-32.png',
];

// インストール時: 必須ファイルをキャッシュ
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_VERSION).then((c) => c.addAll(ASSETS).catch((err) => {
      console.warn('SW cache addAll failed (continuing):', err);
    }))
  );
  self.skipWaiting();
});

// アクティベート時: 旧キャッシュを削除
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))
    ))
  );
  self.clients.claim();
});

// fetch: 戦略は network-first + cache-fallback
//   理由: GAS API や 動的データ (SVG/PNG) は常に最新が欲しい
//          ネットワーク失敗時のみ キャッシュから返す
self.addEventListener('fetch', (e) => {
  const req = e.request;
  // GET 以外は素通し (POST 等は キャッシュしない)
  if (req.method !== 'GET') return;
  // GAS API は キャッシュ完全スキップ (常に fresh)
  if (req.url.includes('script.google.com')) return;
  // raw.githubusercontent.com (admin SVG fetch) もスキップ
  if (req.url.includes('raw.githubusercontent.com')) return;

  // network-first
  e.respondWith(
    fetch(req).then((res) => {
      // 成功したら キャッシュ更新 (同じ origin のみ)
      try {
        if (res && res.status === 200 && req.url.startsWith(self.location.origin)) {
          const clone = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(req, clone));
        }
      } catch (_) {}
      return res;
    }).catch(() => caches.match(req).then((m) => m || new Response('Offline', { status: 503 })))
  );
});
