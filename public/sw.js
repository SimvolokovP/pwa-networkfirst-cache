const HTML_CACHE_NAME = "html-cache-v6";
const API_CACHE_NAME = "api-data-v6";
const STATIC_ASSETS_CACHE = "static-assets-v6";
const CACHE_WHITELIST = [HTML_CACHE_NAME, API_CACHE_NAME, STATIC_ASSETS_CACHE];
const OFFLINE_URL = "/offline.html";

// Исключения: эти пути вообще не будут обрабатываться логикой кэширования
const CACHE_EXCLUDE = ["/admin", "/about", "/cart"];

function shouldCache(request) {
  const url = new URL(request.url);

  // Проверяем, не входит ли путь в список исключений
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

  // Если метод не GET или путь в исключениях — просто пропускаем запрос в сеть
  if (request.method !== "GET" || !shouldCache(request)) return;

  // --- СТРАТЕГИЯ ДЛЯ API (Network First) ---
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

  // --- СТРАТЕГИЯ ДЛЯ HTML (Network ONLY с Fallback на offline.html) ---
  if (request.headers.get("accept")?.includes("text/html")) {
    event.respondWith(
      fetch(request)
        .catch(async () => {
          // Отдаем offline.html только если сети нет
          const offlinePage = await caches.match(OFFLINE_URL);
          return offlinePage || new Response("Сеть недоступна", { status: 503 });
        })
    );
    return;
  }

  // --- СТРАТЕГИЯ ДЛЯ СТАТИКИ (Cache First) ---
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
