const HTML_CACHE_NAME = "html-cache-v4";
const API_CACHE_NAME = "api-data-v4"; // Новый кэш для запросов данных
const STATIC_ASSETS_CACHE = "static-assets-v4";
const CACHE_WHITELIST = [HTML_CACHE_NAME, API_CACHE_NAME, STATIC_ASSETS_CACHE];
const OFFLINE_URL = "/offline.html";

// Исключения (не кэшируем)
const CACHE_EXCLUDE = ["/admin", "/about", "/cart"];

function shouldCache(request) {
  const url = new URL(request.url);
  return (
    url.origin === self.location.origin ||
    url.hostname.includes("googleapis.com") // Разрешаем кэш для Google Books API, если используешь его напрямую
  );
}

// 1. Установка
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_ASSETS_CACHE).then((cache) => {
      return cache.addAll([OFFLINE_URL]);
    })
  );
  self.skipWaiting();
});

// 2. Активация (удаление старых кэшей)
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

// 3. Основная обработка запросов
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET") return;

  // --- СТРАТЕГИЯ ДЛЯ API (Network First) ---
  if (url.pathname.includes("/api/") || url.hostname.includes("googleapis.com")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(API_CACHE_NAME).then((cache) => {
              // put автоматически перезаписывает старый ответ для данного URL (включая query-параметры)
              cache.put(request, copy);
            });
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

  // --- СТРАТЕГИЯ ДЛЯ HTML (Network First) ---
  if (request.headers.get("accept")?.includes("text/html")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(HTML_CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          const cachedResponse = await caches.match(request);
          return cachedResponse || caches.match(OFFLINE_URL);
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
          if (response.ok && shouldCache(request)) {
            const copy = response.clone();
            caches.open(STATIC_ASSETS_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
      );
    })
  );
});

// 4. Сообщения от клиента
self.addEventListener("message", (event) => {
  const { type, url, html } = event.data || {};

  if (type === "SKIP_WAITING") self.skipWaiting();

  // Сохранение HTML из SPA навигации
  if (type === "CACHE_CURRENT_HTML" && html && url) {
    caches.open(HTML_CACHE_NAME).then((cache) => {
      cache.put(url, new Response(html, { headers: { "Content-Type": "text/html" } }));
    });
  }

  // Очистка кэша API (если нужно принудительно обновить данные)
  if (type === "CLEAR_API_CACHE") {
    caches.delete(API_CACHE_NAME);
  }
});
