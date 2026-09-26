/**
 * Where a signup came from.
 *
 * FIRST TOUCH, captured once per browser on the first page ever loaded, and
 * written to the profile only when that browser signs up. The first visit is
 * the one that matters: the tenth one, after a friend's reminder, is not what
 * brought them.
 *
 * WHAT IS KEPT is deliberately small: UTM tags (40 chars each), the referring
 * DOMAIN (never the full URL, which can carry personal data in its query),
 * the landing route with ids and tokens stripped by the same normalizePath the
 * page-view analytics uses, and a channel derived from all of it. No IP, no
 * user agent, no full URL.
 *
 * `channelFor` is pure so the precedence rules can be tested without a browser.
 */
import { normalizePath } from './route-shape'

const KEY = 'ct_first_touch'

export interface FirstTouch {
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  referrer_host?: string
  landing_path: string
  at: string
}

/** Short source links (concordiatracker.com/ig …) and the channel each names. */
export const SOURCE_LINKS: Record<string, string> = {
  r: 'reddit',
  ig: 'instagram',
  li: 'linkedin',
  qr: 'in_person',
}

const SEARCH = /(^|\.)(google|bing|duckduckgo|yahoo|ecosia|qwant|brave)\./
const AI = /(^|\.)(chatgpt\.com|openai\.com|perplexity\.ai|claude\.ai|gemini\.google\.com|copilot\.microsoft\.com)$/
const SOCIAL = /(^|\.)(facebook\.com|fb\.com|t\.co|x\.com|twitter\.com|tiktok\.com|youtube\.com|discord\.com|snapchat\.com|threads\.net)$/

function utmChannel(source: string, medium: string): string | null {
  const s = source.toLowerCase()
  const m = medium.toLowerCase()
  if (/instagram|^ig$/.test(s)) return 'instagram'
  if (/linkedin|^li$/.test(s)) return 'linkedin'
  if (/reddit/.test(s)) return 'reddit'
  if (/qr|flyer|poster|survey|booth|in[_-]?person/.test(s) || /qr|print|offline|in[_-]?person/.test(m)) return 'in_person'
  if (/email|newsletter/.test(s) || m === 'email') return 'email'
  if (s) return 'campaign'
  return null
}

function referrerChannel(host: string): string {
  const h = host.toLowerCase()
  if (/(^|\.)instagram\.com$/.test(h)) return 'instagram'
  if (/(^|\.)linkedin\.com$|^lnkd\.in$/.test(h)) return 'linkedin'
  if (/(^|\.)reddit\.com$/.test(h)) return 'reddit'
  if (SEARCH.test(h)) return 'search'
  if (AI.test(h)) return 'ai_assistant'
  if (SOCIAL.test(h)) return 'social'
  if (/(^|\.)concordia\.ca$/.test(h)) return 'concordia'
  return 'referral_site'
}

/**
 * One word for how somebody arrived, in order of how deliberate the signal is:
 * an invite link beats a tagged link, which beats a named source link, which
 * beats a person's referral code, which beats whatever site they came from.
 */
export function channelFor(i: {
  touch: FirstTouch | null
  sourceRef: string | null
  referralCode: string | null
}): string {
  const t = i.touch
  const path = t?.landing_path ?? ''
  if (/^\/(join|organizer\/join|organizer\/invite|teacher\/invite)(\/|$)/.test(path)) return 'invite'
  const fromUtm = t ? utmChannel(t.utm_source ?? '', t.utm_medium ?? '') : null
  if (fromUtm) return fromUtm
  if (i.sourceRef && /^[a-z_]{1,32}$/.test(i.sourceRef)) return i.sourceRef
  if (i.referralCode) return 'referral'
  if (t?.referrer_host) return referrerChannel(t.referrer_host)
  return t ? 'direct' : 'unknown'
}

const clip = (v: string | null, n: number) => (v ? v.slice(0, n) : undefined)

/** Build the first-touch record from a URL and a referrer. Pure. */
export function firstTouchFrom(href: string, referrer: string, now: Date): FirstTouch {
  const url = new URL(href)
  const q = url.searchParams
  let referrer_host: string | undefined
  try {
    if (referrer) {
      const h = new URL(referrer).hostname.replace(/^www\./, '').toLowerCase()
      if (h && h !== url.hostname.replace(/^www\./, '').toLowerCase() && /^[a-z0-9.-]{1,100}$/.test(h)) {
        referrer_host = h
      }
    }
  } catch {
    /* a malformed referrer is no referrer */
  }
  const touch: FirstTouch = {
    landing_path: normalizePath(url.pathname).slice(0, 120),
    at: now.toISOString(),
  }
  const src = clip(q.get('utm_source'), 40)
  const med = clip(q.get('utm_medium'), 40)
  const camp = clip(q.get('utm_campaign'), 40)
  if (src) touch.utm_source = src
  if (med) touch.utm_medium = med
  if (camp) touch.utm_campaign = camp
  if (referrer_host) touch.referrer_host = referrer_host
  return touch
}

/** Record the first page this browser ever loaded. Later visits never overwrite it. */
export function captureFirstTouch(): void {
  try {
    if (localStorage.getItem(KEY)) return
    localStorage.setItem(
      KEY,
      JSON.stringify(firstTouchFrom(window.location.href, document.referrer, new Date())),
    )
  } catch {
    /* storage blocked: the signup simply goes unattributed */
  }
}

export function readFirstTouch(): FirstTouch | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const t = JSON.parse(raw) as FirstTouch
    return typeof t?.landing_path === 'string' ? t : null
  } catch {
    return null
  }
}

/** The profile columns written once, at signup. */
export function signupAttribution(sourceRef: string | null, referralCode: string | null) {
  const touch = readFirstTouch()
  const channel = channelFor({ touch, sourceRef, referralCode })
  return {
    signup_channel: channel,
    ...(touch?.utm_source ? { signup_utm_source: touch.utm_source } : {}),
    ...(touch?.utm_medium ? { signup_utm_medium: touch.utm_medium } : {}),
    ...(touch?.utm_campaign ? { signup_utm_campaign: touch.utm_campaign } : {}),
    ...(touch?.referrer_host ? { signup_referrer_host: touch.referrer_host } : {}),
    ...(touch?.landing_path ? { signup_landing_path: touch.landing_path } : {}),
    ...(touch?.at ? { first_seen_at: touch.at } : {}),
  }
}
