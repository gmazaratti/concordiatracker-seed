/**
 * Links inside a bio, stored as text.
 *
 * THE FORMAT IS `[label](https://…)`, and it is stored in the same plain-text
 * column a bio has always been. Three reasons it is not HTML: the column is
 * read by a dozen surfaces that would all have to start sanitising; a bio is
 * edited in a textarea by a person, and the markup has to survive being looked
 * at; and anything we fail to parse degrades to the characters themselves,
 * which is legible, rather than to markup showing through.
 *
 * ONLY http(s) BECOMES A LINK. A bio is somebody else's text rendered in your
 * browser, so `javascript:` and `data:` are the whole attack surface — they
 * are not escaped or stripped, they simply never become an anchor and the
 * label is shown as plain words.
 *
 * BARE URLS ARE LINKED TOO, because people paste them and expect it. The
 * explicit form exists so a club can write "our Linktree" instead.
 */

export type BioNode =
  | { kind: 'text'; text: string }
  | { kind: 'link'; text: string; href: string }

/** `[label](url)` — label may not contain brackets, url may not contain spaces. */
const EXPLICIT = /\[([^\]\n]{1,80})\]\((https?:\/\/[^\s)]{1,300})\)/g
/** A bare URL, stopping before trailing punctuation that is almost always prose. */
const BARE = /\bhttps?:\/\/[^\s<>()[\]]{2,300}/g

function safeHref(raw: string): string | null {
  try {
    const url = new URL(raw)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null
  } catch {
    return null
  }
}

/** Trailing `.`/`,`/`!`/`?`/`:` is sentence punctuation, not part of the link. */
function trimTrailing(url: string): { href: string; rest: string } {
  const m = /[.,!?:;]+$/.exec(url)
  if (!m) return { href: url, rest: '' }
  return { href: url.slice(0, -m[0].length), rest: m[0] }
}

export function parseBio(raw: string): BioNode[] {
  const out: BioNode[] = []
  const push = (text: string) => {
    if (!text) return
    const last = out[out.length - 1]
    if (last?.kind === 'text') last.text += text
    else out.push({ kind: 'text', text })
  }

  let i = 0
  EXPLICIT.lastIndex = 0
  for (const m of raw.matchAll(EXPLICIT)) {
    const at = m.index ?? 0
    linkBare(raw.slice(i, at))
    const href = safeHref(m[2])
    if (href) out.push({ kind: 'link', text: m[1], href })
    // A refused protocol is shown as what it is rather than silently dropped:
    // hiding it would mean the author cannot see why their link is not one.
    else push(m[0])
    i = at + m[0].length
  }
  linkBare(raw.slice(i))
  return out

  function linkBare(chunk: string) {
    let j = 0
    BARE.lastIndex = 0
    for (const m of chunk.matchAll(BARE)) {
      const at = m.index ?? 0
      push(chunk.slice(j, at))
      const { href, rest } = trimTrailing(m[0])
      const safe = safeHref(href)
      if (safe) out.push({ kind: 'link', text: href.replace(/^https?:\/\//, ''), href: safe })
      else push(href)
      push(rest)
      j = at + m[0].length
    }
    push(chunk.slice(j))
  }
}

/** True when the text carries at least one thing that will render as a link. */
export function hasLink(raw: string): boolean {
  return parseBio(raw).some((n) => n.kind === 'link')
}

/**
 * Wrap a selection in link markup.
 *
 * Returns the whole new value and where the caret should land, because the
 * caller has to put it back: a textarea that loses the caret after an action
 * makes you find your place again every time.
 */
export function insertLink(
  value: string,
  start: number,
  end: number,
  href: string,
): { value: string; caret: number } {
  const label = value.slice(start, end).trim() || 'link'
  const markup = `[${label}](${href})`
  return {
    value: value.slice(0, start) + markup + value.slice(end),
    caret: start + markup.length,
  }
}

/** What a typed-in address should become before it is stored. */
export function normaliseHref(raw: string): string | null {
  const v = raw.trim()
  if (!v) return null
  // A bare domain is what people type; assuming https is right in 2026 and
  // wrong only for hosts that do not work in a browser anyway.
  const withProtocol = /^[a-z][a-z0-9+.-]*:/i.test(v) ? v : `https://${v}`
  return safeHref(withProtocol)
}
