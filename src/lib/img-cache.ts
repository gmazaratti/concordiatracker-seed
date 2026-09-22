/**
 * Pictures that do not blink.
 *
 * THE PROBLEM, and it is not a caching problem in the HTTP sense. Avatars and
 * post images are already served with a year-long `cache-control`, so the
 * bytes are local after the first look. What the user sees instead is the
 * REMOUNT: React tears a screen down, builds it again, and every `<img>` on it
 * starts from zero — no intrinsic size, nothing painted — so for one or two
 * frames the profile shows initials where a face was, and a post shows a grey
 * square. It reads as a reload even when nothing was fetched.
 *
 * So this module records which URLs have successfully decoded IN THIS SESSION.
 * A known-good image is rendered at full opacity immediately and told to decode
 * synchronously; an unknown one fades in once it lands. Same bytes, same
 * requests — the difference is entirely whether the app admits it already has
 * the picture.
 *
 * `warm()` is the other half: hand it the URLs a screen is about to need and
 * the browser fetches them while the rest of the data is still in flight. It
 * is a hint, never a dependency — nothing waits on it and a failure is silent.
 */

const decoded = new Set<string>()
/** In-flight or finished preloads, so warming twice costs one request. */
const asked = new Set<string>()

export function isWarm(url: string | null | undefined): boolean {
  return !!url && decoded.has(url)
}

export function markWarm(url: string | null | undefined): void {
  if (url) decoded.add(url)
}

/**
 * Pull these into the browser's cache now.
 *
 * Bounded on purpose: a feed can hand over a hundred URLs and firing a hundred
 * parallel requests on a phone is how you make the thing you are trying to
 * speed up slower. The first few are what somebody sees before they scroll.
 */
export function warm(urls: (string | null | undefined)[], limit = 6): void {
  if (typeof Image === 'undefined') return
  let n = 0
  for (const url of urls) {
    if (n >= limit) break
    if (!url || asked.has(url)) continue
    asked.add(url)
    n += 1
    const img = new Image()
    // Same attributes the real element will use, or the preload lands in a
    // different cache entry and buys nothing.
    img.referrerPolicy = 'no-referrer'
    img.decoding = 'async'
    img.onload = () => decoded.add(url)
    img.onerror = () => asked.delete(url)
    img.src = url
  }
}
