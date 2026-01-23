const VERSION = 'v6.1.2';
const HTML_CACHE_NAME = `html-cache-${VERSION}`;
const API_CACHE_NAME = `api-data-${VERSION}`;
const STATIC_ASSETS_CACHE = `static-assets-${VERSION}`;
const CACHE_WHITELIST = [HTML_CACHE_NAME, API_CACHE_NAME, STATIC_ASSETS_CACHE];

const OFFLINE_URL = "/offline.html";
const CACHE_EXCLUDE = ["/admin", "/about", "/cart"];

const TTL_CONFIG = {
  [HTML_CACHE_NAME]: 24 * 60 * 60 * 1000, 
  [API_CACHE_NAME]: 12 * 60 * 60 * 1000,      
};

function shouldCache(request) {
  const url = new URL(request.url);
  const isExcluded = CACHE_EXCLUDE.some(path => url.pathname.startsWith(path));
  if (isExcluded) return false;

  return (
    url.origin === self.location.origin ||
    url.hostname.includes("googleapis.com")
  );
}

async function getValidCachedResponse(cacheName, request) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);
  if (!cachedResponse) return null;

  const dateHeader = cachedResponse.headers.get('sw-cache-timestamp');
  if (!dateHeader) return cachedResponse;

  const age = Date.now() - parseInt(dateHeader, 10);
  const ttl = TTL_CONFIG[cacheName] || Infinity;

  if (age > ttl) return null;
  return cachedResponse;
}

async function cacheWithTimestamp(cacheName, request, response) {
  const cache = await caches.open(cacheName);
  const responseClone = response.clone(); 
  
  const headers = new Headers(responseClone.headers);
  headers.append('sw-cache-timestamp', Date.now().toString());

  const body = await responseClone.blob(); 
  const responseToCache = new Response(body, {
    status: responseClone.status,
    statusText: responseClone.statusText,
    headers: headers
  });

  await cache.put(request, responseToCache);
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_ASSETS_CACHE).then((cache) => cache.addAll([OFFLINE_URL]))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => !CACHE_WHITELIST.includes(name))
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET" || !shouldCache(request)) return;

  if (url.pathname.includes("/api/") || url.hostname.includes("googleapis.com")) {
    event.respondWith(
      fetch(request)
        .then(async (networkResponse) => {
          if (networkResponse.ok) {
            // Передаем оригинал, функция внутри сама сделает клон
            await cacheWithTimestamp(API_CACHE_NAME, request, networkResponse);
          }
          return networkResponse;
        })
        .catch(async () => {
          const validResponse = await getValidCachedResponse(API_CACHE_NAME, request);
          return validResponse || new Response(JSON.stringify({ error: "offline" }), {
            status: 503,
            headers: { "Content-Type": "application/json" }
          });
        })
    );
    return;
  }

  if (request.headers.get("accept")?.includes("text/html")) {
    event.respondWith(
      fetch(request)
        .then(async (networkResponse) => {
          if (networkResponse.ok) {
            await cacheWithTimestamp(HTML_CACHE_NAME, request, networkResponse);
          }
          return networkResponse;
        })
        .catch(async () => {
          const validResponse = await getValidCachedResponse(HTML_CACHE_NAME, request);
          if (validResponse) return validResponse;
          const offlinePage = await caches.match(OFFLINE_URL);
          return offlinePage || new Response("Offline", { status: 503 });
        })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }
        
        const responseToCache = networkResponse.clone();
        caches.open(STATIC_ASSETS_CACHE).then((cache) => {
          cache.put(request, responseToCache);
        });

        return networkResponse;
      });
    })
  );
});

self.addEventListener("message", (event) => {
  const { type } = event.data || {};
  if (type === "SKIP_WAITING") self.skipWaiting();
  if (type === "CLEAR_API_CACHE") caches.delete(API_CACHE_NAME);
});
