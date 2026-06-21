/*
 * ConcordiaTracker service worker — app-shell caching for fast loads + flaky
 * networks. Deliberately small and transparent (no build-time magic) so it's
 * safe to ship on a live site.
 *
 * Strategy:
 *   • Navigations  → NetworkFirst, falling back to the cached shell offline.
 *       (HTML is never served cache-first, so a NEW DEPLOY is picked up the next
 *        time the user is online — no "stuck on old version" trap.)
 *   • /assets/*    → CacheFirst. Vite content-hashes these, so they're immutable
 *       and safe to cache forever; a new build emits new filenames.
 *   • other static → StaleWhileRevalidate (icons, manifest, og image).
 *   • /api/* + any cross-origin (Supabase, Google, fonts) → untouched (network).
 *
 * Updating: bump VERSION on a breaking change — `activate` purges every cache
 * that doesn't match, so old entries can't linger.
 *
 * KILL SWITCH: if caching ever misbehaves, replace this whole file's body with:
 *     self.addEventListener('install', () => self.skipWaiting())
 *     self.addEventListener('activate', (e) => e.waitUntil(
 *       caches.keys().then((k) => Promise.all(k.map((c) => caches.delete(c))))
 *         .then(() => self.registration.unregister())
 *         .then(() => self.clients.matchAll()).then((cs) => cs.forEach((c) => c.navigate(c.url)))))
 *   Deploy it; every client self-unregisters and clears its caches on next load.
 */
const VERSION = 'ct-v3'
const SHELL_CACHE = `${VERSION}-shell`
const ASSET_CACHE = `${VERSION}-assets`
const SHELL_URL = '/index.html'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.add(SHELL_URL))
      .catch(() => {}) // a transient offline install shouldn't brick registration
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting()
})

function cachePut(cacheName, request, response) {
  // Only cache complete, same-origin 200s — never an error/redirect/opaque body.
  if (response && response.ok && response.status === 200) {
    const copy = response.clone()
    caches.open(cacheName).then((cache) => cache.put(request, copy))
  }
  return response
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  // Leave the API, auth, and every cross-origin call (Supabase, Google, fonts) alone.
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/')) return

  // App navigations → fresh HTML when online, cached shell when not.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => cachePut(SHELL_CACHE, SHELL_URL, res))
        .catch(() => caches.match(SHELL_URL).then((cached) => cached || Response.error())),
    )
    return
  }

  // Immutable hashed build assets → cache-first.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then(
        (cached) => cached || fetch(request).then((res) => cachePut(ASSET_CACHE, request, res)),
      ),
    )
    return
  }

  // Other same-origin static (icons, manifest, og) → stale-while-revalidate.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((res) => cachePut(ASSET_CACHE, request, res))
        .catch(() => cached)
      return cached || network
    }),
  )
})

/* ---- Web Push ---- */

// A push arrived from the server → show a notification. The server sends a JSON
// payload { title, body, url? }; we fall back to sensible defaults if it's empty.
self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data ? event.data.text() : '' }
  }
  const title = data.title || 'ConcordiaTracker'
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: data.tag || 'ct-notification',
      data: { url: data.url || '/app' },
    }),
  )
})

// Tapping the notification → focus an existing app window or open one.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = event.notification.data?.url || '/app'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.navigate?.(target)
          return client.focus()
        }
      }
      return self.clients.openWindow(target)
    }),
  )
})
