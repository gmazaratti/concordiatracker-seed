/**
 * The public club page as HTML — pure, so it can be tested without a network.
 *
 * Everything a search engine or a link preview needs is in this one response:
 * a title and description built from the club's own words, a canonical URL,
 * Open Graph tags for the banner, and Organization + Event structured data
 * whose `sameAs` points at the club's Instagram / LinkedIn / website. That last
 * part is what lets a search engine understand this page and those profiles
 * are the same entity — the same signal behind a person's Twitter showing up
 * under their name.
 *
 * Every string from the database goes through `esc()` (or `jsonLd()` inside the
 * script tag). Nothing is trusted: a bio is typed by a club officer.
 */
import { isOfficialOrg } from '../src/features/community/official.js'

export const SITE = 'https://concordiatracker.com'

export interface ClubOrg {
  handle: string
  name: string
  verified: boolean
  glyph: string | null
  color: string | null
  logo: string | null
  banner: string | null
  bio: string | null
  links: Record<string, unknown> | null
  venue: { address?: string; phone?: string; hours?: string[] } | null
}

export interface ClubEvent {
  id: string
  title: string
  start: string
  mode: string | null
  location: string | null
  image: string | null
  recurrence: string | null
}

export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

/** JSON inside <script>: `</` must never appear, or a bio could close the tag. */
function jsonLd(v: unknown): string {
  return JSON.stringify(v).replace(/</g, '\\u003c')
}

export function slugOf(handle: string): string {
  return handle.replace(/^@/, '').toLowerCase()
}

/** An http(s) URL only. Anything else is not a link we will publish. */
function httpUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const v = raw.trim()
  if (!v) return null
  const withScheme = /^https?:\/\//i.test(v) ? v : /^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(v) ? `https://${v}` : null
  if (!withScheme) return null
  try {
    const u = new URL(withScheme)
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : null
  } catch {
    return null
  }
}

const PLATFORM_HOSTS: Record<string, string> = {
  instagram: 'https://www.instagram.com/',
  x: 'https://x.com/',
  tiktok: 'https://www.tiktok.com/@',
}

/** The club's links as real URLs, in a stable order, with a readable name. */
export function clubLinks(links: ClubOrg['links']): { label: string; href: string }[] {
  if (!links) return []
  const titles = (links.titles ?? {}) as Record<string, string>
  const out: { label: string; href: string }[] = []
  for (const key of ['website', 'instagram', 'x', 'linkedin', 'tiktok']) {
    const raw = links[key]
    let href = httpUrl(raw)
    if (!href && typeof raw === 'string' && /^@?[\w.]{2,30}$/.test(raw.trim()) && PLATFORM_HOSTS[key]) {
      href = PLATFORM_HOSTS[key] + raw.trim().replace(/^@/, '')
    }
    if (!href) continue
    const host = new URL(href).hostname.replace(/^www\./, '')
    out.push({ label: titles[key]?.trim() || host, href })
  }
  return out
}

/** Bio text with `[label](https://…)` turned into links; everything else escaped. */
function bioHtml(bio: string): string {
  const parts: string[] = []
  let last = 0
  for (const m of bio.matchAll(/\[([^\]\n]{1,80})\]\((https?:\/\/[^\s)]+)\)/g)) {
    parts.push(esc(bio.slice(last, m.index)))
    parts.push(`<a href="${esc(m[2])}" rel="nofollow noopener" target="_blank">${esc(m[1])}</a>`)
    last = m.index! + m[0].length
  }
  parts.push(esc(bio.slice(last)))
  return parts.join('').replace(/\n/g, '<br>')
}

function plainBio(bio: string): string {
  return bio.replace(/\[([^\]\n]{1,80})\]\((https?:\/\/[^\s)]+)\)/g, '$1').replace(/\s+/g, ' ').trim()
}

function clip(s: string, n: number): string {
  return s.length <= n ? s : `${s.slice(0, n - 1).replace(/\s+\S*$/, '')}…`
}

const TZ = 'America/Toronto'
function when(iso: string): string {
  const d = new Date(iso)
  const day = new Intl.DateTimeFormat('en-CA', { weekday: 'short', month: 'short', day: 'numeric', timeZone: TZ }).format(d)
  const time = new Intl.DateTimeFormat('en-CA', { hour: 'numeric', minute: '2-digit', timeZone: TZ }).format(d)
  return `${day} · ${time}`
}

/** Test and throwaway clubs get a page but are kept out of search. */
export function isTestClub(handle: string): boolean {
  return /(^|[-_.])test|probe/i.test(slugOf(handle))
}

export function renderClubPage(org: ClubOrg, events: ClubEvent[]): string {
  const slug = slugOf(org.handle)
  const url = `${SITE}/c/${slug}`
  const appUrl = `${SITE}/app/community/org/${slug}`
  const bio = org.bio?.trim() ?? ''
  const title = `${org.name} (${org.handle}) · Events at Concordia | ConcordiaTracker`
  const description = clip(
    bio ? plainBio(bio) : `Upcoming events from ${org.name} at Concordia University, on ConcordiaTracker.`,
    158,
  )
  const links = clubLinks(org.links)
  const color = /^#[0-9a-f]{3,8}$/i.test(org.color ?? '') ? org.color! : '#3b4a5a'
  const seal = isOfficialOrg(org.handle) ? '#912338' : '#5aa9f0'
  const image = org.banner ?? org.logo

  const ld: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: org.name,
    alternateName: org.handle,
    url,
    ...(org.logo ? { logo: org.logo } : {}),
    ...(org.banner ? { image: org.banner } : {}),
    ...(bio ? { description: plainBio(bio) } : {}),
    ...(links.length ? { sameAs: links.map((l) => l.href) } : {}),
    ...(org.venue?.phone ? { telephone: org.venue.phone } : {}),
    ...(org.venue?.address ? { address: org.venue.address } : {}),
    ...(events.length
      ? {
          event: events.map((e) => ({
            '@type': 'Event',
            name: e.title,
            startDate: e.start,
            url: `${SITE}/e/${e.id}`,
            eventAttendanceMode:
              e.mode === 'online'
                ? 'https://schema.org/OnlineEventAttendanceMode'
                : 'https://schema.org/OfflineEventAttendanceMode',
            location:
              e.mode === 'online'
                ? { '@type': 'VirtualLocation', url: `${SITE}/e/${e.id}` }
                : { '@type': 'Place', name: e.location || 'Concordia University', address: e.location || 'Montreal, QC' },
            organizer: { '@type': 'Organization', name: org.name, url },
          })),
        }
      : {}),
  }

  const logo = org.logo
    ? `<img class="logo" src="${esc(org.logo)}" alt="${esc(org.name)} logo" width="96" height="96">`
    : `<div class="logo glyph" style="background:${esc(color)}">${esc(org.glyph ?? org.name.slice(0, 2))}</div>`

  const venue = org.venue
  const venueHtml = venue
    ? [
        venue.address
          ? `<a class="meta" href="https://www.google.com/maps/search/?api=1&amp;query=${encodeURIComponent(venue.address)}" rel="noopener" target="_blank">📍 ${esc(venue.address)}</a>`
          : '',
        venue.hours?.length ? `<p class="meta hours"><span>🕐</span><span>${venue.hours.map(esc).join('<br>')}</span></p>` : '',
        venue.phone ? `<p class="meta">📞 ${esc(venue.phone)}</p>` : '',
      ].join('')
    : ''

  const eventsHtml = events.length
    ? events
        .map(
          (e) => `<a class="event" href="/e/${esc(e.id)}">
  ${(e.image ?? org.banner) ? `<img src="${esc((e.image ?? org.banner)!)}" alt="" loading="lazy">` : `<div class="ph" style="background:${esc(color)}"></div>`}
  <div><strong>${esc(e.title)}</strong><span>${esc(when(e.start))}${e.location ? ` · ${esc(e.location)}` : ''}${e.recurrence ? ` · ${esc(e.recurrence)}` : ''}</span></div>
</a>`,
        )
        .join('\n')
    : `<p class="empty">No upcoming events right now.</p>`

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${url}">
<meta name="robots" content="${isTestClub(org.handle) ? 'noindex, nofollow' : 'index, follow'}">
<meta property="og:type" content="profile">
<meta property="og:site_name" content="ConcordiaTracker">
<meta property="og:title" content="${esc(`${org.name} (${org.handle})`)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${url}">
${image ? `<meta property="og:image" content="${esc(image)}">` : ''}
<meta name="twitter:card" content="${org.banner ? 'summary_large_image' : 'summary'}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<script type="application/ld+json">${jsonLd(ld)}</script>
<style>
:root{color-scheme:dark;--bg:#0f0f16;--surface:#191926;--border:#2a2a3a;--fg:#f2f1f6;--muted:#a9a6b8;--accent:#8fb39a}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.55 system-ui,-apple-system,"Segoe UI",Inter,sans-serif}
a{color:inherit}main{max-width:760px;margin:0 auto;padding:16px 16px 48px}
.top{display:flex;justify-content:space-between;align-items:center;padding:4px 0 16px}.brand{font-weight:700;text-decoration:none}
.cta{background:var(--accent);color:#0e1c14;text-decoration:none;font-weight:600;padding:8px 14px;border-radius:10px;font-size:14px}
.banner{width:100%;aspect-ratio:4/1;object-fit:cover;border-radius:16px;display:block;background:${esc(color)}}
.head{display:flex;gap:18px;align-items:flex-end;margin-top:-40px;padding:0 6px}
.logo{width:96px;height:96px;border-radius:50%;object-fit:cover;border:4px solid var(--bg);background:var(--surface);flex:none}
.glyph{display:grid;place-items:center;font-weight:800;font-size:30px;color:#fff}
h1{font-size:24px;line-height:1.2;margin:0}.handle{color:var(--muted);margin:2px 0 0}
.seal{width:18px;height:18px;vertical-align:-2px;margin-left:6px;color:${seal}}.meta.hours{display:flex;gap:6px}
.bio{margin:16px 6px 0;max-width:62ch}.bio a{color:var(--accent)}
.meta{display:block;color:var(--muted);margin:6px 6px 0;font-size:14px;text-decoration:none}
.links{display:flex;flex-wrap:wrap;gap:8px;margin:14px 6px 0}.links a{border:1px solid var(--border);border-radius:999px;padding:5px 12px;font-size:13px;text-decoration:none}
h2{font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin:32px 6px 12px}
.event{display:flex;gap:14px;align-items:center;padding:10px;border:1px solid var(--border);border-radius:14px;margin-bottom:10px;text-decoration:none;background:var(--surface)}
.event img,.event .ph{width:96px;height:64px;border-radius:10px;object-fit:cover;flex:none}
.event strong{display:block}.event span{color:var(--muted);font-size:13.5px}.empty{color:var(--muted);margin:0 6px}
footer{margin-top:40px;color:var(--muted);font-size:12.5px;text-align:center}
</style>
</head>
<body>
<main>
<div class="top"><a class="brand" href="/">ConcordiaTracker</a><a class="cta" href="${appUrl}">Follow on ConcordiaTracker</a></div>
${org.banner ? `<img class="banner" src="${esc(org.banner)}" alt="${esc(org.name)} banner">` : `<div class="banner"></div>`}
<div class="head">${logo}<div><h1>${esc(org.name)}${org.verified ? `<svg class="seal" viewBox="0 0 24 24" role="img" aria-label="Verified"><path fill="currentColor" d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/><path d="m8.5 12 2.5 2.5 4.5-5" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>` : ''}</h1><p class="handle">${esc(org.handle)}</p></div></div>
${bio ? `<p class="bio">${bioHtml(bio)}</p>` : ''}
${venueHtml}
${links.length ? `<nav class="links" aria-label="Links">${links.map((l) => `<a href="${esc(l.href)}" rel="noopener me" target="_blank">${esc(l.label)}</a>`).join('')}</nav>` : ''}
<h2>Upcoming events</h2>
${eventsHtml}
<footer>ConcordiaTracker is a student-built app for Concordia University students. Not affiliated with Concordia University.</footer>
</main>
</body>
</html>`
}
