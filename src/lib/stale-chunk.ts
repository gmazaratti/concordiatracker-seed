/**
 * "A new version is out and this tab is still running the old one."
 *
 * Every screen but the landing page and Today is its own chunk, fetched the
 * first time you open it. A deploy replaces those files with new, differently
 * named ones — so a tab left open across a deploy asks for a chunk that no
 * longer exists and the screen crashes with "Failed to fetch dynamically
 * imported module". That is what took the Blueprints page down once; a hard
 * reload fixed it because a reload fetches the new build.
 *
 * So do that reload for them, ONCE. The guard matters: if the chunk is missing
 * for some other reason, reloading forever would be worse than the crash.
 */
const KEY = 'ct_stale_chunk_reload'

/** Messages browsers use for a chunk that could not be loaded. */
export function isStaleChunkError(err: unknown): boolean {
  const msg = err instanceof Error ? `${err.name} ${err.message}` : String(err ?? '')
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|ChunkLoadError|Loading chunk \S+ failed/i.test(
    msg,
  )
}

/** Reload the page, unless we already did so for this reason in the last minute.
 *  Returns whether a reload was started. */
export function reloadForNewVersion(): boolean {
  try {
    const last = Number(sessionStorage.getItem(KEY) ?? 0)
    if (Date.now() - last < 60_000) return false
    sessionStorage.setItem(KEY, String(Date.now()))
  } catch {
    // No storage (private mode): still reload once — the page has nothing to
    // lose, and without the guard we simply cannot tell a second time apart.
  }
  window.location.reload()
  return true
}
