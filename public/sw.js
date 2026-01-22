const CACHE_NAME = "html-cache-v9";
const STATIC_ASSETS_CACHE = "static-assets-v9";
const API_CACHE_NAME = "books-api-v9"; // Новый кэш для API
const CACHE_WHITELIST = [CACHE_NAME, STATIC_ASSETS_CACHE, API_CACHE_NAME];
const TTL = 10 * 60 * 1000; // 10 minutes
const OFFLINE_URL = "/offline.html";

// TTL для API кэша (можно установить дольше, например, 30 минут)
const API_TTL = 30 * 60 * 1000; // 30 минут

let cacheDisabled = false;

const CACHE_EXCLUDE = ["/about"];

// Обновленные паттерны для API
const API_PATTERNS = [
  /\/api\//i,
  /\.json$/i,
  /\/(categories|carts|products|users|orders)\b/i,
];

// Специальные паттерны для Google Books API
const GOOGLE_BOOKS_PATTERNS = [
  /^https:\/\/www\.googleapis\.com\/books\/v1\//i,
  /volumes\?q=/i,
  /volumes\//i,
];

const API_HEADERS = [
  "application/json",
  "application/xml",
  "text/xml",
];

function shouldCache(request) {
  return !CACHE_EXCLUDE.some((path) => request.url.includes(path));
}

// Проверяем, поддерживается ли схема URL для кэширования
function isCacheableScheme(urlString) {
  try {
    const url = new URL(urlString);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

// Проверяем, является ли запрос к Google Books API
function isGoogleBooksApiRequest(request) {
  const url = new URL(request.url);
  return GOOGLE_BOOKS_PATTERNS.some(pattern => pattern.test(url.toString()));
}

// Универсальная проверка на API запрос
function isApiRequest(request) {
  const url = new URL(request.url);

  // Проверяем по паттернам URL
  if (API_PATTERNS.some(pattern => pattern.test(url.pathname))) {
    return true;
  }

  // Проверяем Google Books API
  if (isGoogleBooksApiRequest(request)) {
    return true;
  }

  // Проверяем заголовки Content-Type или Accept
  const contentType = request.headers.get('Content-Type') || '';
  const acceptHeader = request.headers.get('Accept') || '';

  // Если запрос явно ожидает JSON/XML или отправляет JSON/XML
  if (API_HEADERS.some(header =>
    contentType.includes(header) || acceptHeader.includes(header)
  )) {
    return true;
  }

  return false;
}

const MESSAGE_EVENT_TYPES = {
  CACHE_CURRENT_HTML: "CACHE_CURRENT_HTML",
  REVALIDATE_URL: "REVALIDATE_URL",
  DISABLE_CACHE: "DISABLE_CACHE",
  ENABLE_CACHE: "ENABLE_CACHE",
  CLEAR_STATIC_CACHE: "CLEAR_STATIC_CACHE",
  CLEAR_API_CACHE: "CLEAR_API_CACHE", // Новый тип сообщения
};

// Check: is it HTML
const isHTML = (request) => {
  return request.headers.get("accept")?.includes("text/html");
};

// Проверяем, является ли запрос кэшируемым API
function isCacheableApiRequest(request) {
  // Не кэшируем POST, PUT, DELETE запросы
  if (request.method !== "GET") {
    return false;
  }

  // Проверяем, является ли это Google Books API
  if (isGoogleBooksApiRequest(request)) {
    return true;
  }

  // Для других API можно добавить дополнительные проверки
  return false;
}

// Network-first стратегия для API (с fallback на кэш)
async function handleApiRequest(request) {
  const cache = await caches.open(API_CACHE_NAME);
  const url = request.url;
  const cacheKey = request;

  try {
    // Пытаемся получить свежие данные из сети
    console.log(`[SW] Fetching API data from network: ${url}`);
    const networkResponse = await fetch(request);

    // Если успешно, обновляем кэш
    if (networkResponse.ok) {
      const responseToCache = networkResponse.clone();

      // Сохраняем в кэш с timestamp
      await cache.put(cacheKey, responseToCache);
      await cache.put(
        url + ":ts",
        new Response(JSON.stringify({
          ts: Date.now(),
          url: url
        }))
      );

      console.log(`[SW] API data cached: ${url}`);
      return networkResponse;
    }

    // Если сетевой запрос неудачный, пробуем кэш
    throw new Error(`HTTP ${networkResponse.status}`);

  } catch (networkError) {
    console.log(`[SW] Network failed, trying cache: ${url}`, networkError.message);

    // Пробуем получить данные из кэша
    const cachedResponse = await cache.match(cacheKey);
    const cachedTimestamp = await cache.match(url + ":ts");

    if (cachedResponse && cachedTimestamp) {
      try {
        const timestampData = await cachedTimestamp.json();
        const age = Date.now() - timestampData.ts;

        // Проверяем свежесть кэша
        if (age < API_TTL) {
          console.log(`[SW] Serving API from cache (${Math.floor(age / 1000)}s old): ${url}`);

          // Добавляем заголовок, указывающий, что это кэшированные данные
          const headers = new Headers(cachedResponse.headers);
          headers.set('X-Cache', 'HIT');
          headers.set('X-Cache-Age', `${Math.floor(age / 1000)}s`);

          return new Response(cachedResponse.body, {
            status: cachedResponse.status,
            statusText: cachedResponse.statusText,
            headers: headers
          });
        } else {
          console.log(`[SW] API cache expired (${Math.floor(age / 1000)}s old): ${url}`);
        }
      } catch (e) {
        console.warn(`[SW] Error reading cache timestamp: ${url}`, e);
      }
    }

    // Если нет свежего кэша или кэша нет вообще
    console.log(`[SW] No valid cache available for: ${url}`);

    // Для Google Books API возвращаем специальный offline ответ
    if (isGoogleBooksApiRequest(request)) {
      return new Response(JSON.stringify({
        error: {
          code: 503,
          message: "Service Unavailable - You are offline",
          errors: [{
            message: "Unable to fetch data from Google Books API. Please check your connection.",
            domain: "global",
            reason: "backendError"
          }]
        },
        cachedBooks: [], // Можно добавить последние кэшированные книги
        offline: true,
        timestamp: new Date().toISOString()
      }), {
        status: 503,
        headers: {
          'Content-Type': 'application/json',
          'X-Offline': 'true'
        }
      });
    }

    // Для других API возвращаем общий offline ответ
    return new Response(JSON.stringify({
      error: 'offline',
      message: 'You are offline and no cached data is available',
      timestamp: new Date().toISOString()
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Stale-while-revalidate стратегия для Google Books API
async function handleGoogleBooksRequest(request) {
  const cache = await caches.open(API_CACHE_NAME);
  const url = request.url;
  const cacheKey = request;

  // Сначала пытаемся вернуть данные из кэша (если есть)
  const cachedResponse = await cache.match(cacheKey);
  const cachedTimestamp = await cache.match(url + ":ts");

  // Если есть кэш, возвращаем его сразу (не дожидаясь сети)
  if (cachedResponse && cachedTimestamp) {
    try {
      const timestampData = await cachedTimestamp.json();
      const age = Date.now() - timestampData.ts;

      // Добавляем заголовок о возрасте кэша
      const headers = new Headers(cachedResponse.headers);
      headers.set('X-Cache', 'HIT');
      headers.set('X-Cache-Age', `${Math.floor(age / 1000)}s`);

      // Создаем ответ с кэшированными данными
      const response = new Response(cachedResponse.body, {
        status: cachedResponse.status,
        statusText: cachedResponse.statusText,
        headers: headers
      });

      // В фоновом режиме обновляем кэш, если он устарел
      if (age > API_TTL) {
        console.log(`[SW] Cache stale, revalidating in background: ${url}`);

        // Не блокируем ответ - обновляем кэш в фоне
        fetch(request)
          .then(async (networkResponse) => {
            if (networkResponse.ok) {
              await cache.put(cacheKey, networkResponse.clone());
              await cache.put(
                url + ":ts",
                new Response(JSON.stringify({
                  ts: Date.now(),
                  url: url
                }))
              );
              console.log(`[SW] Background cache updated: ${url}`);
            }
          })
          .catch(err => {
            console.log(`[SW] Background revalidation failed: ${url}`, err.message);
          });
      }

      console.log(`[SW] Serving Google Books API from cache: ${url}`);
      return response;

    } catch (e) {
      console.warn(`[SW] Error with cached response: ${url}`, e);
    }
  }

  // Если кэша нет или он поврежден, используем обычную network-first стратегию
  return handleApiRequest(request);
}

// Installation — cache offline.html
self.addEventListener("install", (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(STATIC_ASSETS_CACHE).then((cache) => {
        return cache.addAll([OFFLINE_URL]);
      }),
      caches.open(API_CACHE_NAME).then((cache) => {
        // Можно предзагрузить популярные запросы к Google Books API
        const popularQueries = [
          'https://www.googleapis.com/books/v1/volumes?q=javascript&maxResults=5',
          'https://www.googleapis.com/books/v1/volumes?q=react&maxResults=5',
          'https://www.googleapis.com/books/v1/volumes?q=programming&maxResults=5'
        ];

        return Promise.allSettled(
          popularQueries.map(url =>
            fetch(url).then(response => {
              if (response.ok) {
                return cache.put(url, response.clone());
              }
            }).catch(() => { })
          )
        );
      })
    ])
  );
  self.skipWaiting();
});

// Activation — take control immediately
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => !CACHE_WHITELIST.includes(cacheName))
            .map((cacheName) => caches.delete(cacheName))
        );
      })
      .then(() => self.clients.claim())
  );
});

// Processing fetch requests
self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Пропускаем неподдерживаемые схемы
  if (!isCacheableScheme(request.url)) {
    return;
  }

  // Пропускаем не-GET запросы
  if (request.method !== "GET") {
    return;
  }

  // Проверяем, является ли это Google Books API запросом
  if (isGoogleBooksApiRequest(request)) {
    event.respondWith(handleGoogleBooksRequest(request));
    return;
  }

  // Для других API используем обычную обработку
  if (isApiRequest(request) && !isGoogleBooksApiRequest(request)) {
    console.log('[SW] Skipping non-Books API request:', request.url);
    return;
  }

  const url = new URL(request.url);

  // Проверяем, не является ли запрос страницей about
  if (url.pathname === '/about' || url.pathname.startsWith('/about/')) {
    event.respondWith(
      fetch(request)
        .then(async (response) => {
          return response;
        })
        .catch(() => {
          return caches.match(OFFLINE_URL);
        })
    );
    return;
  }

  if (cacheDisabled || !shouldCache(request)) {
    return;
  }

  // HTML pages - Network First стратегия
  if (isHTML(request)) {
    event.respondWith(
      (async () => {
        try {
          const networkResponse = await fetch(request);

          if (networkResponse.ok && isCacheableScheme(request.url)) {
            const cache = await caches.open(CACHE_NAME);
            await cache.put(request, networkResponse.clone());
            await cache.put(
              request.url + ":ts",
              new Response(JSON.stringify({ ts: Date.now() }))
            );
          }

          return networkResponse;
        } catch (error) {
          const cache = await caches.open(CACHE_NAME);
          const cachedResponse = await cache.match(request);

          if (cachedResponse) {
            console.log('[SW] Serving from cache (network failed):', request.url);
            return cachedResponse;
          }

          const fallback = await caches.match(OFFLINE_URL);
          return fallback || new Response("Offline", { status: 503 });
        }
      })()
    );
  }

  // Static assets - Cache First
  else {
    event.respondWith(
      caches.open(STATIC_ASSETS_CACHE).then((cache) =>
        cache.match(request).then((cached) => {
          return (
            cached ||
            fetch(request)
              .then((response) => {
                if (response.status === 200 && isCacheableScheme(request.url)) {
                  cache.put(request, response.clone());
                }
                return response;
              })
              .catch(() => undefined)
          );
        })
      )
    );
  }
});

// Processing messages from the client
self.addEventListener("message", (event) => {
  const { type, url, ts, html } = event.data || {};

  // Global enable/disable caching
  if (type === MESSAGE_EVENT_TYPES.DISABLE_CACHE) {
    cacheDisabled = true;
  }
  if (type === MESSAGE_EVENT_TYPES.ENABLE_CACHE) {
    cacheDisabled = false;
  }

  // Fast activation of a new service worker
  if (type === "SKIP_WAITING") {
    self.skipWaiting();
  }

  // Очистка кэша Google Books API
  if (type === MESSAGE_EVENT_TYPES.CLEAR_API_CACHE) {
    console.log("[SW] Clearing Google Books API cache");
    caches.open(API_CACHE_NAME)
      .then(async (cache) => {
        const keys = await cache.keys();
        console.log(`[SW] Found ${keys.length} entries in API cache`);

        // Удаляем только Google Books API записи
        const deletePromises = keys.map(async (key) => {
          const requestUrl = key.url || key;
          if (isGoogleBooksApiRequest(new Request(requestUrl))) {
            await cache.delete(key);
            // Также удаляем timestamp
            await cache.delete(requestUrl + ":ts");
          }
        });

        await Promise.all(deletePromises);
        console.log("[SW] Google Books API cache cleared");

        // Уведомляем клиент
        event.source.postMessage({
          type: 'API_CACHE_CLEARED',
          timestamp: new Date().toISOString()
        });
      })
      .catch((err) => {
        console.error("[SW] Error clearing API cache:", err);
      });
  }

  // Invalidation by URL to update the cache manually
  if (type === MESSAGE_EVENT_TYPES.REVALIDATE_URL && url) {
    if (!isCacheableScheme(url) || isApiRequest(new Request(url))) {
      console.log("[SW] Skipping revalidation for API/unsupported scheme:", url);
      return;
    }

    caches.open(CACHE_NAME).then(async (cache) => {
      try {
        const response = await fetch(url, { headers: { Accept: "text/html" } });
        await cache.put(url, response.clone());
        await cache.put(
          url + ":ts",
          new Response(JSON.stringify({ ts: Date.now() }))
        );
        console.log("[SW] Revalidated and updated cache for:", url);
      } catch (err) {
        console.error("[SW] Failed to revalidate cache for:", url, err);
      }
    });
  }

  // Clear static assets cache
  if (type === MESSAGE_EVENT_TYPES.CLEAR_STATIC_CACHE) {
    console.log("[SW] Received CLEAR_STATIC_CACHE message");
    caches
      .open(STATIC_ASSETS_CACHE)
      .then(async (cache) => {
        const keys = await cache.keys();
        console.log(
          "[SW] Found",
          keys.length,
          "entries in static assets cache"
        );
        await Promise.all(keys.map((key) => cache.delete(key)));
        console.log("[SW] Cleared static assets cache");
      })
      .catch((err) => {
        console.error("[SW] Error clearing static assets cache:", err);
      });
  }

  // SPA: manually cache HTML
  if (type === MESSAGE_EVENT_TYPES.CACHE_CURRENT_HTML && html && url) {
    if (cacheDisabled) {
      console.log("[SW] Skipping cache (cacheDisabled):", url);
      return;
    }

    if (!isCacheableScheme(url) || isApiRequest(new Request(url))) {
      console.log("[SW] Skipping cache for API/unsupported scheme:", url);
      return;
    }

    if (url.includes('/about')) {
      console.log("[SW] Skipping cache for about page:", url);
      return;
    }

    caches.open(CACHE_NAME).then(async (cache) => {
      const existing = await cache.match(url);
      const existingTs = await cache.match(url + ":ts");

      if (existing && existingTs) {
        const age = Date.now() - (await existingTs.json()).ts;
        if (age < TTL) {
          console.log("[SW] Skip caching, still fresh:", url);
          return;
        }
      }

      const response = new Response(html, {
        headers: { "Content-Type": "text/html" },
      });

      await cache.put(url, response.clone());
      await cache.put(
        url + ":ts",
        new Response(JSON.stringify({ ts: ts || Date.now() }))
      );

      console.log("[SW] Cached:", url);
    });
  }
});