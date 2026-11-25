/* Service worker sederhana: setelah pernah dimuat sekali, aplikasi dan model tetap bisa dibuka tanpa internet.
 * Naikkan VERSION bila isi /models/ diganti, supaya cache model lama dibuang. */
const VERSION = 'v1';
const APP_CACHE = `deteksi-app-${VERSION}`;
const MODEL_CACHE = `deteksi-models-${VERSION}`;

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keep = new Set([APP_CACHE, MODEL_CACHE]);
    for (const key of await caches.keys()) {
      if (!keep.has(key)) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

// Hanya simpan respons utuh yang benar-benar berkas (bukan halaman HTML pengganti saat berkas tidak ada)
const cacheable = (res, allowHtml) =>
  res.status === 200 && (allowHtml || !(res.headers.get('content-type') || '').includes('text/html'));

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (cacheable(res, false)) cache.put(request, res.clone());
  return res;
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(request);
    if (cacheable(res, true)) cache.put(request, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(request);
    if (hit) return hit;
    throw err;
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || request.headers.has('range')) return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith('/models/')) {
    event.respondWith(cacheFirst(request, MODEL_CACHE)); // model besar: ambil dari cache bila ada
  } else if (url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(request, APP_CACHE)); // nama berkas ber-hash, aman disimpan lama
  } else {
    event.respondWith(networkFirst(request, APP_CACHE)); // halaman & manifest: utamakan versi terbaru
  }
});
