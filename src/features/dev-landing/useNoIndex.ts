import { useEffect } from 'react'

/**
 * Tells crawlers to stay off a draft page for as long as it is mounted.
 *
 * Belt and braces with `Disallow: /dev/` in robots.txt: robots.txt stops a
 * polite crawler from fetching the page, this stops a page that WAS fetched
 * (through a shared link, say) from being indexed. Removed on unmount so the
 * next page in the SPA is not left carrying it.
 */
export function useNoIndex() {
  useEffect(() => {
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex,nofollow'
    meta.setAttribute('data-dev-noindex', '')
    document.head.appendChild(meta)
    return () => meta.remove()
  }, [])
}
