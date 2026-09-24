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
 * Updating: VERSION is STAMPED AT BUILD TIME by scripts/stamp-sw.mjs with the
 * entry bundle's content hash. It used to be a hand-bumped constant, which meant
 * sw.js was byte-identical on every deploy — and a browser only installs a new
 * worker when the SCRIPT changes, so an installed app sat on an old bundle until
 * someone happened to fully relaunch it. Do not put a literal back here; the
 * value below is only what a dev build sees. `activate` purges every cache that
 * doesn't match, so old entries can't linger.
 *
 * KILL SWITCH: if caching ever misbehaves, replace this whole file's body with:
 *     self.addEventListener('install', () => self.skipWaiting())
 *     self.addEventListener('activate', (e) => e.waitUntil(
 *       caches.keys().then((k) => Promise.all(k.map((c) => caches.delete(c))))
 *         .then(() => self.registration.unregister())
 *         .then(() => self.clients.matchAll()).then((cs) => cs.forEach((c) => c.navigate(c.url)))))
 *   Deploy it; every client self-unregisters and clears its caches on next load.
 */
const VERSION = 'ct-dev'
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
  // The write is fire-and-forget, so its failure is caught HERE: an uncaught
  // rejection from a full or unavailable cache used to surface in the console.
  if (response && response.ok && response.status === 200) {
    const copy = response.clone()
    caches
      .open(cacheName)
      .then((cache) => cache.put(request, copy))
      .catch(() => {})
  }
  return response
}

/**
 * EVERY respondWith RESOLVES TO A REAL Response. Two branches used not to:
 * a stale-while-revalidate miss while offline resolved to `undefined` (the
 * "Failed to convert value to 'Response'" TypeError), and a navigation whose
 * fetch failed with no cached shell REJECTED ("the FetchEvent … resulted in a
 * network error response: the promise was rejected"). `settle` turns anything
 * that is not a Response, or any rejection, into the given fallback.
 */
function settle(promise, fallback) {
  return promise
    .then((res) => (res instanceof Response ? res : fallback()))
    .catch(() => fallback())
}

const offlinePage = () =>
  new Response(
    '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Offline</title>' +
      '<body style="font:16px system-ui;background:#0f0f16;color:#f4f3f7;display:grid;place-items:center;min-height:100vh;margin:0">' +
      '<p>You are offline. Reconnect and reload.</p>',
    { status: 503, headers: { 'content-type': 'text/html; charset=utf-8' } },
  )

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  // Leave the API, auth, and every cross-origin call (Supabase, Google, fonts) alone.
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/')) return

  // App navigations → fresh HTML when online, cached shell when not, and a
  // plain offline page when there is no shell yet.
  if (request.mode === 'navigate') {
    event.respondWith(
      settle(
        fetch(request).then((res) => cachePut(SHELL_CACHE, SHELL_URL, res)),
        () => settle(caches.match(SHELL_URL), offlinePage),
      ),
    )
    return
  }

  // Immutable hashed build assets → cache-first.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      settle(
        caches
          .match(request)
          .then((cached) => cached || fetch(request).then((res) => cachePut(ASSET_CACHE, request, res))),
        () => Response.error(),
      ),
    )
    return
  }

  // Other same-origin static (icons, manifest, og) → stale-while-revalidate.
  event.respondWith(
    settle(
      caches.match(request).then((cached) => {
        const network = fetch(request)
          .then((res) => cachePut(ASSET_CACHE, request, res))
          .catch(() => cached || Response.error())
        return cached || network
      }),
      () => Response.error(),
    ),
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

// Tapping the notification → reuse a window that is ALREADY IN THE APP, or open
// a new one. It used to navigate the first window it found, whatever that was:
// a tab sitting on the landing page (or the docs, or a legal page) was pulled
// into /app/community without the person touching it, which read as "opening
// concordiatracker.com skipped the landing page". A page outside /app is left
// exactly where it is.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = event.notification.data?.url || '/app'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const inApp = clients.find((c) => {
        try {
          return new URL(c.url).pathname.startsWith('/app') && 'focus' in c
        } catch {
          return false
        }
      })
      if (inApp) {
        inApp.navigate?.(target)
        return inApp.focus()
      }
      return self.clients.openWindow(target)
    }),
  )
})
