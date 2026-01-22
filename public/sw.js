const HTML_CACHE_NAME = "html-cache-v6";
const API_CACHE_NAME = "api-data-v6";
const STATIC_ASSETS_CACHE = "static-assets-v6";
const CACHE_WHITELIST = [HTML_CACHE_NAME, API_CACHE_NAME, STATIC_ASSETS_CACHE];
const OFFLINE_URL = "/offline.html";

const CACHE_EXCLUDE = ["/admin", "/about", "/cart"];

function shouldCache(request) {
  const url = new URL(request.url);
  const isExcluded = CACHE_EXCLUDE.some(path => url.pathname.startsWith(path));
  if (isExcluded) return false;

  return (
    url.origin === self.location.origin ||
    url.hostname.includes("googleapis.com")
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_ASSETS_CACHE).then((cache) => {
      return cache.addAll([OFFLINE_URL]);
    })
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

  // --- API (Network First) ---
  if (url.pathname.includes("/api/") || url.hostname.includes("googleapis.com")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(API_CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          const cachedResponse = await caches.match(request);
          return cachedResponse || new Response(JSON.stringify({ error: "offline" }), {
            status: 503,
            headers: { "Content-Type": "application/json" }
          });
        })
    );
    return;
  }

  // --- HTML (Network First, Fallback to Cache, then Fallback to Offline Page) ---
  if (request.headers.get("accept")?.includes("text/html")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Если сеть есть, сохраняем страницу в кэш
          if (response.ok) {
            const copy = response.clone();
            caches.open(HTML_CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          // Если сети нет:
          // 1. Ищем конкретно эту страницу в кэше
          const cachedResponse = await caches.match(request);
          if (cachedResponse) return cachedResponse;

          // 2. Если страницы в кэше нет, отдаем заглушку offline.html
          const offlinePage = await caches.match(OFFLINE_URL);
          return offlinePage || new Response("Сеть недоступна", { status: 503 });
        })
    );
    return;
  }

  // --- СТАТИКА (Cache First) ---
  event.respondWith(
    caches.match(request).then((cached) => {
      return (
        cached ||
        fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(STATIC_ASSETS_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
      );
    })
  );
});

self.addEventListener("message", (event) => {
  const { type } = event.data || {};
  if (type === "SKIP_WAITING") self.skipWaiting();
  if (type === "CLEAR_API_CACHE") caches.delete(API_CACHE_NAME);
});
