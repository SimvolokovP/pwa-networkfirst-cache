// public/custom-sw.js
const CACHE_NAME = "pages-cache-v5";
const STATIC_ASSETS_CACHE = "static-assets-cache-v5";
const API_CACHE_NAME = "api-cache-v5";
const CACHE_WHITELIST = [CACHE_NAME, STATIC_ASSETS_CACHE, API_CACHE_NAME];

// TTL настроек из вашего кода
const TTL = 10 * 60 * 1000; // 10 minutes (исправлено с 1 на 10 минут)
const OFFLINE_URL = "/offline"; // Изменено для Next.js

let cacheDisabled = false;

// Массив путей, которые не кэшируются (расширен)
const CACHE_EXCLUDE = [
  "/api/admin",
  "/api/sensitive",
  "/_next/static/chunks/pages/_error",
  "/about",
  "/cart",
  "/offline" // offline страницу тоже не нужно кэшировать по запросу
];

// Константы для сообщений
const MESSAGE_EVENT_TYPES = {
  CACHE_CURRENT_HTML: "CACHE_CURRENT_HTML",
  REVALIDATE_URL: "REVALIDATE_URL",
  DISABLE_CACHE: "DISABLE_CACHE",
  ENABLE_CACHE: "ENABLE_CACHE",
  CLEAR_STATIC_CACHE: "CLEAR_STATIC_CACHE",
  SKIP_WAITING: "SKIP_WAITING",
};

// Проверка: является ли запрос HTML
const isHTML = (request) => {
  return request.headers.get("accept")?.includes("text/html");
};

// Проверка: является ли запрос API
const isAPI = (request) => {
  const url = new URL(request.url);
  return url.pathname.startsWith('/api/');
};

// Проверка: является ли запрос статическим ресурсом Next.js
const isNextStatic = (request) => {
  const url = new URL(request.url);
  return url.pathname.includes('/_next/static/') ||
    url.pathname.includes('/_next/image') ||
    url.pathname.startsWith('/static/');
};

// Проверка: безопасен ли запрос для кэширования
function isCacheableRequest(request) {
  const url = new URL(request.url);

  // Пропускаем не-HTTP/HTTPS запросы
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return false;
  }

  // Пропускаем служебные URL
  if (request.url.startsWith('chrome-extension://') ||
    request.url.startsWith('chrome://') ||
    request.url.startsWith('file://') ||
    request.url.startsWith('about:')) {
    return false;
  }

  return true;
}

// Проверка: нужно ли кэшировать этот запрос
function shouldCache(request) {
  if (!isCacheableRequest(request)) {
    return false;
  }

  const url = new URL(request.url);

  // Пропускаем исключенные пути
  const shouldExclude = CACHE_EXCLUDE.some((path) => {
    // Для точного совпадения путей
    if (path === url.pathname) {
      return true;
    }
    // Для проверки вхождения
    if (path.includes('/') && url.pathname.includes(path)) {
      return true;
    }
    return false;
  });

  return !shouldExclude;
}

// Проверка: является ли запрос offline страницей
function isOfflinePage(request) {
  const url = new URL(request.url);
  return url.pathname === '/offline';
}

// Безопасное добавление в кэш
async function safeCachePut(cacheName, request, response) {
  try {
    if (!isCacheableRequest(request)) {
      return;
    }

    // Проверяем, не является ли это страницами /about или /cart
    const url = new URL(request.url);
    if (url.pathname === '/about' || url.pathname === '/cart') {
      console.log(`[SW] ⚠️ Skipping cache for excluded page: ${url.pathname}`);
      return;
    }

    const cache = await caches.open(cacheName);
    const responseToCache = response.clone();
    await cache.put(request, responseToCache);

    // Для HTML сохраняем timestamp
    if (isHTML(request)) {
      const timestampResponse = new Response(
        JSON.stringify({ ts: Date.now() }),
        { headers: { 'Content-Type': 'application/json' } }
      );
      await cache.put(request.url + ":ts", timestampResponse);
    }

    console.log(`[SW] ✅ Cached: ${request.url} in ${cacheName}`);
  } catch (error) {
    console.error(`[SW] ❌ Failed to cache ${request.url}:`, error);
  }
}

// Безопасное чтение из кэша
async function safeCacheMatch(cacheName, request) {
  try {
    const cache = await caches.open(cacheName);
    return await cache.match(request);
  } catch (error) {
    console.error(`[SW] ❌ Failed to match cache for ${request.url}:`, error);
    return null;
  }
}

// Network-first стратегия для API
async function handleApiRequest(request) {
  const cache = await caches.open(API_CACHE_NAME);

  try {
    // Пробуем сеть
    const networkResponse = await fetch(request);

    // Кэшируем успешные ответы
    if (networkResponse.ok) {
      const responseToCache = networkResponse.clone();
      await cache.put(request, responseToCache);
    }

    return networkResponse;
  } catch (error) {
    // Если нет сети, пробуем кэш
    const cachedResponse = await cache.match(request);

    if (cachedResponse) {
      console.log(`[SW] Serving API from cache: ${request.url}`);
      return cachedResponse;
    }

    // Если нет в кэше, возвращаем offline ответ
    return new Response(
      JSON.stringify({
        error: 'offline',
        message: 'You are offline and no cached data is available',
        timestamp: new Date().toISOString(),
        endpoint: request.url
      }),
      {
        status: 503,
        statusText: 'Service Unavailable',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store'
        }
      }
    );
  }
}

// Stale-while-revalidate стратегия для HTML
async function handleHtmlRequest(request) {
  const url = new URL(request.url);
  
  // Не кэшируем страницы /about и /cart
  if (url.pathname === '/about' || url.pathname === '/cart') {
    console.log(`[SW] ⚠️ Bypassing cache for excluded page: ${url.pathname}`);
    return fetch(request);
  }

  // Не кэшируем offline страницу при прямом запросе
  if (isOfflinePage(request)) {
    return fetch(request);
  }

  if (cacheDisabled || !shouldCache(request)) {
    return fetch(request);
  }

  try {
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(request);
    const cachedTimestamp = await cache.match(request.url + ":ts");

    let age = 0;
    if (cachedResponse && cachedTimestamp) {
      try {
        const timestampData = await cachedTimestamp.json();
        age = Date.now() - timestampData.ts;

        // Если кэш свежий (< 10 минут) - возвращаем его
        if (age < TTL) {
          console.log(`[SW] Serving fresh HTML cache: ${request.url} (${Math.floor(age / 1000)}s old)`);
          return cachedResponse;
        }

        console.log(`[SW] HTML cache stale: ${request.url} (${Math.floor(age / 1000)}s old)`);
      } catch (error) {
        console.error(`[SW] Error reading timestamp: ${request.url}`, error);
      }
    }

    // Кэш устарел или отсутствует - пробуем сеть
    try {
      console.log(`[SW] Fetching fresh HTML: ${request.url}`);
      const response = await fetch(request);

      // Кэшируем только успешные ответы для разрешенных страниц
      if (response.ok && response.status === 200 && shouldCache(request)) {
        await safeCachePut(CACHE_NAME, request, response);
      }

      return response.clone();
    } catch (fetchError) {
      console.warn(`[SW] Fetch failed: ${request.url}`, fetchError);

      // Если есть кэш - возвращаем его (даже старый)
      if (cachedResponse) {
        console.log(`[SW] Serving stale HTML cache: ${request.url}`);
        return cachedResponse;
      }

      // Если нет кэша - редиректим на offline страницу
      console.log(`[SW] Redirecting to offline page: ${request.url}`);
      
      // Создаем ответ с редиректом
      return new Response(null, {
        status: 302,
        statusText: 'Found',
        headers: {
          'Location': '/offline',
          'Cache-Control': 'no-store'
        }
      });
    }
  } catch (error) {
    console.error(`[SW] Error processing HTML request: ${request.url}`, error);
    return fetch(request);
  }
}

// Cache-first стратегия для статических ресурсов
async function handleStaticRequest(request) {
  // Не кэшируем статику для offline страницы (она уже закэширована при установке)
  if (isOfflinePage(request)) {
    return fetch(request);
  }

  try {
    const cache = await caches.open(STATIC_ASSETS_CACHE);
    const cachedResponse = await cache.match(request);

    if (cachedResponse) {
      console.log(`[SW] Serving static asset from cache: ${request.url}`);
      return cachedResponse;
    }

    // Не в кэше - пробуем сеть
    try {
      const response = await fetch(request);

      // Кэшируем успешные ответы
      if (response.ok) {
        await safeCachePut(STATIC_ASSETS_CACHE, request, response);
      }

      return response;
    } catch (fetchError) {
      console.warn(`[SW] Failed to fetch static asset: ${request.url}`, fetchError);
      throw fetchError;
    }
  } catch (error) {
    console.error(`[SW] Error processing static asset: ${request.url}`, error);
    throw error;
  }
}

// Установка Service Worker
self.addEventListener("install", (event) => {
  console.log('[SW] ⚙️ Installing service worker');
  event.waitUntil(
    caches.open(STATIC_ASSETS_CACHE)
      .then((cache) => {
        // Предварительно кэшируем offline страницу и её ресурсы
        const urlsToCache = [
          // Главная страница offline
          '/offline',
          // Статика для offline страницы
          '/_next/static/css/offline.css', // если есть
          '/_next/static/images/offline.svg', // если есть
          // Базовые ресурсы
          '/',
          '/manifest.json',
          // Икони и шрифты
          '/favicon.ico',
          '/robots.txt',
        ].filter(Boolean);

        return Promise.all(
          urlsToCache.map(url => {
            return cache.add(url).catch(err => {
              console.warn(`[SW] Failed to cache ${url}:`, err);
            });
          })
        );
      })
      .then(() => {
        console.log('[SW] ✅ Installation complete');
        return self.skipWaiting();
      })
  );
});

// Активация Service Worker
self.addEventListener("activate", (event) => {
  console.log('[SW] 🔄 Activating service worker');
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => !CACHE_WHITELIST.includes(cacheName))
            .map((cacheName) => {
              console.log(`[SW] Deleting old cache: ${cacheName}`);
              return caches.delete(cacheName);
            })
        );
      })
      .then(() => {
        console.log('[SW] Claiming clients');
        return self.clients.claim();
      })
  );
});

// Обработка fetch запросов
self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Пропускаем не-GET запросы
  if (request.method !== "GET") return;

  // Пропускаем некэшируемые запросы
  if (!isCacheableRequest(request)) {
    return;
  }

  const url = new URL(request.url);
  
  // Специальная обработка для offline страницы
  if (url.pathname === '/offline') {
    // Для offline страницы используем кэш, если есть
    event.respondWith(
      caches.match('/offline')
        .then(cached => cached || fetch(request))
        .catch(() => new Response(
          '<h1>Offline</h1><p>Please check your internet connection.</p>',
          { headers: { 'Content-Type': 'text/html' } }
        ))
    );
    return;
  }

  // Выбираем стратегию в зависимости от типа запроса
  if (isAPI(request)) {
    event.respondWith(handleApiRequest(request));
  } else if (isHTML(request)) {
    // Прямой fetch для страниц /about и /cart без кэширования
    if (url.pathname === '/about' || url.pathname === '/cart') {
      event.respondWith(fetch(request));
    } else {
      event.respondWith(handleHtmlRequest(request));
    }
  } else if (isNextStatic(request)) {
    event.respondWith(handleStaticRequest(request));
  }
  // Для остальных запросов используем CacheFirst
  else {
    event.respondWith(
      handleStaticRequest(request).catch(() => fetch(request))
    );
  }
});

// Обработка сообщений от клиента
self.addEventListener("message", (event) => {
  const { type, url, ts, html } = event.data || {};

  console.log(`[SW] 📨 Received message: ${type}`, { url });

  // Включение/выключение кэширования
  if (type === MESSAGE_EVENT_TYPES.DISABLE_CACHE) {
    cacheDisabled = true;
    console.log('[SW] ⚠️ Cache disabled');
  }

  if (type === MESSAGE_EVENT_TYPES.ENABLE_CACHE) {
    cacheDisabled = false;
    console.log('[SW] ✅ Cache enabled');
  }

  // Быстрая активация нового Service Worker
  if (type === MESSAGE_EVENT_TYPES.SKIP_WAITING) {
    console.log('[SW] ⏩ Skip waiting requested');
    self.skipWaiting();

    // Уведомляем клиентов о обновлении
    event.source.postMessage({ type: 'FORCE_RELOAD' });
  }

  // Ревалидация URL
  if (type === MESSAGE_EVENT_TYPES.REVALIDATE_URL && url) {
    const requestUrl = new URL(url);
    
    // Не ревалидируем страницы /about и /cart
    if (requestUrl.pathname === '/about' || requestUrl.pathname === '/cart') {
      console.log(`[SW] Skipping revalidation for excluded page: ${requestUrl.pathname}`);
      return;
    }

    console.log(`[SW] 🔄 Revalidating: ${url}`);

    if (!isCacheableRequest(new Request(url))) {
      console.log(`[SW] Cannot revalidate non-cacheable URL: ${url}`);
      return;
    }

    caches.open(CACHE_NAME).then(async (cache) => {
      try {
        const response = await fetch(url, {
          headers: {
            'Accept': 'text/html',
            'Cache-Control': 'no-cache'
          }
        });

        if (response.ok) {
          await safeCachePut(CACHE_NAME, new Request(url), response);
          console.log(`[SW] ✅ Successfully revalidated: ${url}`);

          // Уведомляем клиент об успехе
          event.source.postMessage({
            type: 'REVALIDATION_SUCCESS',
            url
          });
        } else {
          console.error(`[SW] Revalidation failed: ${url} - HTTP ${response.status}`);
        }
      } catch (err) {
        console.error(`[SW] ❌ Failed to revalidate ${url}:`, err);
      }
    });
  }

  // Очистка статического кэша
  if (type === MESSAGE_EVENT_TYPES.CLEAR_STATIC_CACHE) {
    console.log("[SW] 🧹 Clearing static assets cache");

    caches.open(STATIC_ASSETS_CACHE)
      .then(async (cache) => {
        const keys = await cache.keys();
        console.log(`[SW] Found ${keys.length} entries in static cache`);

        await Promise.all(
          keys.map((key) => cache.delete(key))
        );

        console.log("[SW] ✅ Static cache cleared");

        event.source.postMessage({
          type: 'CACHE_CLEARED',
          cache: 'static'
        });
      })
      .catch((err) => {
        console.error("[SW] ❌ Error clearing static cache:", err);
      });
  }

  // Ручное кэширование HTML (для SPA)
  if (type === MESSAGE_EVENT_TYPES.CACHE_CURRENT_HTML && html && url) {
    const requestUrl = new URL(url);
    
    // Не кэшируем страницы /about и /cart
    if (requestUrl.pathname === '/about' || requestUrl.pathname === '/cart') {
      console.log(`[SW] Cannot manually cache excluded page: ${requestUrl.pathname}`);
      return;
    }

    if (cacheDisabled) {
      console.log(`[SW] Skipping cache (disabled): ${url}`);
      return;
    }

    if (!isCacheableRequest(new Request(url))) {
      console.log(`[SW] Cannot cache non-cacheable URL: ${url}`);
      return;
    }

    console.log(`[SW] 📝 Manual HTML cache for: ${url}`);

    caches.open(CACHE_NAME).then(async (cache) => {
      const existing = await cache.match(new Request(url));
      const existingTs = await cache.match(new Request(url + ":ts"));

      if (existing && existingTs) {
        try {
          const timestampData = await existingTs.json();
          const age = Date.now() - timestampData.ts;
          if (age < TTL) {
            console.log(`[SW] Skip caching ${url}, still fresh`);
            return;
          }
        } catch (error) {
          console.error(`[SW] Error reading timestamp: ${url}`, error);
        }
      }

      const response = new Response(html, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'X-SW-Cached': 'true',
          'Cache-Control': 'public, max-age=0, must-revalidate'
        },
      });

      await safeCachePut(CACHE_NAME, new Request(url), response);
      console.log(`[SW] ✅ Manually cached HTML: ${url}`);
    });
  }
});

// Глобальные обработчики ошибок
self.addEventListener('error', (event) => {
  console.error('[SW] 🚨 Global error:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('[SW] 🚨 Unhandled promise rejection:', event.reason);
});