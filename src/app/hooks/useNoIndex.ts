import { useEffect } from 'react'

/**
 * Tells crawlers to stay off a draft page for as long as it is mounted.
 *
 * Belt and braces with `Disallow: /dev/` in robots.txt: robots.txt stops a
 * polite crawler from fetching the page, this stops a page that WAS fetched
 * (through a shared link, say) from being indexed.
 *
 * It REWRITES the site's own robots tag rather than adding a second one:
 * index.html ships `index, follow`, and two contradictory tags leave the answer
 * to each crawler's tie-break. The original value is put back on unmount, so the
 * next page in the SPA is indexed normally.
 */
export function useNoIndex(content = 'noindex, nofollow') {
  useEffect(() => {
    let meta = document.head.querySelector<HTMLMetaElement>('meta[name="robots"]')
    const created = !meta
    if (!meta) {
      meta = document.createElement('meta')
      meta.name = 'robots'
      document.head.appendChild(meta)
    }
    const previous = meta.content
    meta.content = content
    return () => {
      if (created) meta.remove()
      else meta.content = previous
    }
  }, [content])
}
