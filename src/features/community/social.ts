import type { OrgLinks, SocialKey } from '@/data/community'
import { linkHref, type ProfileLinks } from '@/lib/social'

export interface SocialField {
  key: SocialKey
  label: string
  placeholder: string
  /** What the club would probably call it, offered in the editor so the field
   *  is not an empty box with no idea what belongs in it. */
  titleHint: string
}

/** The org links shown on a profile + editable in the profile editor. One list
 * drives both the editor fields and the public icon buttons (icons live in
 * `SocialLinks.tsx`, keyed by `key`). */
export const SOCIAL_FIELDS: SocialField[] = [
  { key: 'website', label: 'Website / custom link', placeholder: 'https://linktr.ee/yourorg', titleHint: 'All our links' },
  { key: 'instagram', label: 'Instagram', placeholder: 'https://instagram.com/yourorg', titleHint: 'Instagram' },
  { key: 'x', label: 'X (Twitter)', placeholder: 'https://x.com/yourorg', titleHint: 'X' },
  { key: 'linkedin', label: 'LinkedIn', placeholder: 'https://linkedin.com/company/yourorg', titleHint: 'LinkedIn' },
  { key: 'tiktok', label: 'TikTok', placeholder: 'https://tiktok.com/@yourorg', titleHint: 'TikTok' },
]

/* ── The links line ───────────────────────────────────────────────────────── */

export interface ProfileLink {
  kind: SocialKey
  href: string
  /** What the link is CALLED. The club's own title when it set one; the host
   *  otherwise, which is what the profile showed before titles existed. */
  label: string
}

/** Bare host, no `www.` — a link's name when nobody gave it one. */
export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url.replace(/^https?:\/\//i, '').replace(/^www\./, '').split('/')[0] || 'link'
  }
}

/** Only http(s) reaches an `href`, so a `javascript:` string in the column
 *  cannot become a link. Anything else is rebuilt as https. */
function safeHref(raw: string): string {
  const v = raw.trim()
  if (/^https?:\/\//i.test(v)) return v
  return `https://${v.replace(/^\/+/, '')}`
}

/** An org's links in the order the editor lists them, titles applied. */
export function orgProfileLinks(links?: OrgLinks): ProfileLink[] {
  if (!links) return []
  const out: ProfileLink[] = []
  for (const f of SOCIAL_FIELDS) {
    const raw = links[f.key]?.trim()
    if (!raw) continue
    const href = safeHref(raw)
    out.push({ kind: f.key, href, label: links.titles?.[f.key]?.trim() || hostOf(href) })
  }
  return out
}

/**
 * A student's links, in the same shape.
 *
 * People do not get to title a link — the four fields already say what each
 * one is — so a platform link is labelled with the HANDLE it points at and a
 * website with its host. "instagram.com" under somebody's bio says nothing;
 * "@alex" is the part they would have typed out themselves.
 */
export function personProfileLinks(links: ProfileLinks): ProfileLink[] {
  const out: ProfileLink[] = []
  for (const f of SOCIAL_FIELDS) {
    if (f.key === 'tiktok') continue // not a field a person has
    const raw = links[f.key]?.trim()
    if (!raw) continue
    const href = linkHref(f.key, raw)
    if (!href) continue
    out.push({ kind: f.key, href, label: f.key === 'website' ? hostOf(href) : handleOf(href) })
  }
  return out
}

/** The last path segment of a profile URL — `/in/alex` and `/alex` both give
 *  `@alex`; anything without one falls back to the host. */
function handleOf(href: string): string {
  try {
    const seg = new URL(href).pathname.split('/').filter(Boolean).pop()
    return seg ? `@${decodeURIComponent(seg)}` : hostOf(href)
  } catch {
    return hostOf(href)
  }
}
