import { useEffect } from 'react'

const SITE = 'https://concordiatracker.com'

function upsertMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function upsertCanonical(href: string) {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', 'canonical')
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}

/**
 * Per-route SEO. Sets the document title, meta description, canonical URL, and
 * the matching Open Graph fields by MUTATING the tags already in index.html
 * (so there are never duplicate/conflicting tags). Googlebot renders JS, so
 * each route ends up with its own correct title/description/canonical, and the
 * site-wide og:image from index.html carries through.
 */
export function usePageMeta({
  title,
  description,
  path,
}: {
  title: string
  description?: string
  path: string
}) {
  useEffect(() => {
    const url = `${SITE}${path}`
    document.title = title
    upsertMeta('property', 'og:title', title)
    upsertMeta('property', 'og:url', url)
    upsertCanonical(url)
    if (description) {
      upsertMeta('name', 'description', description)
      upsertMeta('property', 'og:description', description)
    }
  }, [title, description, path])
}
