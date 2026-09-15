/**
 * eConcordia catalogue + outline client.
 *
 * eConcordia publishes the CURRENT TERM's course outline for every online
 * course as a public PDF, no login. That is the only authoritative, machine-
 * readable source of assessment schedules we have found: Concordia's Open Data
 * has no outline endpoint at all, and its schedule feed currently stops at
 * Winter 2026, so it cannot even tell us which courses run this term.
 *
 * THE SLUG TRICK. The outline URL is not derived from the course code. Each
 * card on courses.aspx carries a thumbnail whose filename IS the slug, and the
 * outline lives at /outlines/<slug>.pdf:
 *
 *   COMM 305 → …/courses/managerial_accounting.jpg
 *            → https://www.econcordia.com/outlines/managerial_accounting.pdf
 *
 * NO HEADLESS BROWSER IS NEEDED — measured, against the brief. The semester
 * filter is an ASP.NET postback (`__doPostBack` on `ddlSemester`), and driving
 * that with curl does only ever return the default term. But the page ALSO
 * accepts the semester as a plain query parameter: `courses.aspx?semester=123`
 * returns 58 Winter cards with no cookies, no VIEWSTATE and no postback.
 * Verified 15 Sep 2026 against all six semester ids. That matters beyond
 * tidiness: Playwright cannot run in the serverless function this has to live
 * in, and this repo keeps exactly one runtime dependency on purpose.
 *
 * `?semester=All Courses` does NOT work (it silently returns the default set),
 * so the semesters are walked one at a time — which is what we want anyway,
 * because the semester is the term attribution.
 *
 * POLITENESS: `courses.aspx` is fetched once per semester per run and each PDF
 * once, paced by `POLITE_MS`. robots.txt disallows only /my/ and /my2/.
 */

export const ECONCORDIA = 'https://www.econcordia.com'
export const CATALOG_URL = `${ECONCORDIA}/home/courses.aspx`

/** Identify ourselves. A scraper that will not say who it is has no business
 *  complaining when it gets blocked. */
export const USER_AGENT =
  'ConcordiaTrackerBot/1.0 (+https://concordiatracker.com/about; course outline sync)'

/** One request a second, and we mean it. */
export const POLITE_MS = 1100

/**
 * eConcordia's own semester ids, with the term name we file them under.
 *
 * The LABEL is read from the page at run time (it carries the year, e.g.
 * "Fall/Winter (September 8, 2026 - April 12, 2027)"), because hard-coding
 * "Fall 2026" here would silently mis-file every outline the moment the year
 * rolls over. These names are only the season half.
 */
export const SEMESTERS: { id: string; season: string }[] = [
  { id: '118', season: 'Summer' },
  { id: '119', season: 'Summer' },
  { id: '120', season: 'Summer' },
  { id: '121', season: 'Fall' },
  { id: '122', season: 'Fall/Winter' },
  { id: '123', season: 'Winter' },
]

export interface CatalogCourse {
  /** eConcordia's internal course id, from the card's href. */
  id: string
  /** The semester id the card was listed under. */
  semester: string
  /** Thumbnail filename — the key to the outline URL. */
  slug: string
  /** One or more Concordia codes. A card may carry "AHSC 322/AHSC 522". */
  codes: string[]
  title: string
}

/**
 * Cards out of the catalogue HTML.
 *
 * Deliberately anchored on the full card shape (href → img → h3 → p) rather
 * than on the slug alone: the page also references thumbnails outside the
 * course grid, and matching those would invent courses that are not there.
 */
export function parseCatalog(html: string, semester: string): CatalogCourse[] {
  const re =
    /<a href="CourseDetails\.aspx\?id=(\d+)&semester=(\d+)"[^>]*>\s*<img src="\/home\/src\/assets\/images\/courses\/([a-z0-9_-]+)\.jpg"[^>]*>\s*<h3[^>]*>([^<]*)<\/h3>\s*<p>([\s\S]*?)<\/p>/g
  const out: CatalogCourse[] = []
  const seen = new Set<string>()
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) {
    const slug = m[3]
    if (seen.has(slug)) continue
    seen.add(slug)
    out.push({
      id: m[1],
      semester: m[2] || semester,
      slug,
      codes: splitCodes(m[4]),
      title: decodeEntities(m[5]).replace(/\s+/g, ' ').trim(),
    })
  }
  return out
}

/**
 * "AHSC 322/AHSC 522" → two codes; "COMM 305" → one.
 *
 * Cross-listed courses share one outline and one card, and filing that outline
 * under only the first code hides it from half the students who need it.
 * Normalised to "SUBJ 123" so it joins the rest of the app, which stores the
 * spaced form.
 */
export function splitCodes(raw: string): string[] {
  const out: string[] = []
  for (const part of decodeEntities(raw).split(/[/,]/)) {
    const m = /([A-Za-z]{2,5})\s*-?\s*(\d{3}[A-Za-z]?)/.exec(part.trim())
    if (m) {
      const code = `${m[1].toUpperCase()} ${m[2].toUpperCase()}`
      if (!out.includes(code)) out.push(code)
    }
  }
  return out
}

/** The label eConcordia prints for a semester id, e.g. "Fall/Winter (September
 *  8, 2026 - April 12, 2027)". Null when the page does not list it — the
 *  CURRENT term is the page default and is often absent from its own dropdown. */
export function semesterLabel(html: string, id: string): string | null {
  const m = new RegExp(`<option value="${id}"[^>]*>([^<]*)</option>`).exec(html)
  return m ? decodeEntities(m[1]).trim() : null
}

/**
 * The term a semester belongs to, as the rest of the app spells it.
 *
 * The YEAR comes from the dates in the label, never from our own clock: a
 * scrape that ran on 2 January must not file the Winter term under the year
 * that just ended. Falls back to null rather than guessing.
 */
export function termNameFrom(season: string, label: string | null): string | null {
  if (!label) return null
  const years = [...label.matchAll(/\b(20\d{2})\b/g)].map((m) => Number(m[1]))
  if (years.length === 0) return null
  // A Fall/Winter span runs across two calendar years; it is named for the one
  // it STARTS in, which is the first date printed.
  const year = years[0]
  return `${season} ${year}`
}

export function outlineUrl(slug: string): string {
  return `${ECONCORDIA}/outlines/${slug}.pdf`
}

export async function fetchText(url: string): Promise<string> {
  const r = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
  if (!r.ok) throw new Error(`${url} → HTTP ${r.status}`)
  return r.text()
}

export interface OutlineFetch {
  status: number
  bytes: Uint8Array | null
}

/** A missing outline is a normal outcome (five Fall slugs 404), so it comes
 *  back as a status rather than a thrown error. */
export async function fetchOutline(url: string): Promise<OutlineFetch> {
  const r = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
  if (!r.ok) return { status: r.status, bytes: null }
  return { status: 200, bytes: new Uint8Array(await r.arrayBuffer()) }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

/** Stable content hash, so an unchanged outline costs one GET and no model
 *  call. Web Crypto, available on both runtimes. */
export async function sha256(bytes: Uint8Array): Promise<string> {
  const buf = await crypto.subtle.digest(
    'SHA-256',
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
  )
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Text out of a PDF, with no dependency.
 *
 * Inflates every FlateDecode stream and pulls the strings out of the text
 * operators. This is NOT a general PDF renderer — it does not do predictors,
 * CID fonts, or column ordering — but course outlines are generated from Word
 * and it recovers their text cleanly, which is all the extractor downstream
 * needs. Adding a PDF library to a repo with one runtime dependency, to read
 * one kind of document we have already proved parses, is not a trade worth
 * making.
 *
 * Returns '' when nothing readable comes out (a scanned outline, say), and the
 * caller treats that as a parse failure rather than an empty outline.
 */
export async function pdfText(bytes: Uint8Array): Promise<string> {
  const latin = new TextDecoder('latin1').decode(bytes)
  const chunks: string[] = []
  let i = 0
  while (true) {
    const a = latin.indexOf('stream', i)
    if (a < 0) break
    let start = a + 6
    if (latin[start] === '\r') start++
    if (latin[start] === '\n') start++
    const end = latin.indexOf('endstream', start)
    if (end < 0) break
    const raw = bytes.subarray(start, end)
    const text = await inflate(raw)
    if (text) chunks.push(text)
    i = end + 9
  }
  return chunks.map(showText).join('\n')
}

/**
 * Inflate one stream, KEEPING what came out before any error.
 *
 * This is the whole trick, and the first version got it wrong: a PDF stream
 * is followed by an EOL before `endstream`, so the bytes handed to the
 * decompressor almost always end in a byte or two of padding. Node and the
 * browser both then throw "Trailing junk found after the end of the compressed
 * stream" — AFTER emitting every byte of real output. Awaiting
 * `Response.arrayBuffer()` throws that error away along with the 23KB of text
 * that already decoded, which is why the first run reported no readable text
 * in all 45 outlines.
 *
 * Reading the stream by hand and swallowing the tail error keeps the output.
 */
async function inflate(raw: Uint8Array): Promise<string | null> {
  for (const format of ['deflate', 'deflate-raw'] as const) {
    const parts: Uint8Array[] = []
    try {
      const ds = new DecompressionStream(format)
      const reader = new Blob([raw.slice() as unknown as BlobPart])
        .stream()
        .pipeThrough(ds)
        .getReader()
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        if (value) parts.push(value)
      }
    } catch {
      /* trailing padding, or the wrong format — either way keep what decoded */
    }
    if (parts.length === 0) continue
    let n = 0
    for (const p of parts) n += p.length
    const merged = new Uint8Array(n)
    let at = 0
    for (const p of parts) {
      merged.set(p, at)
      at += p.length
    }
    return new TextDecoder('latin1').decode(merged)
  }
  return null
}

/** `(a) Tj` and `[(a)-1(b)] TJ` → "ab", one line per text-showing operation. */
function showText(content: string): string {
  const STR = /\((?:\\.|[^\\()])*\)/g
  const out: string[] = []
  for (const line of content.split('\n')) {
    if (!/T[Jj]/.test(line)) continue
    const parts = line.match(STR)
    if (!parts) continue
    let s = ''
    for (const p of parts) s += p.slice(1, -1).replace(/\\([()\\])/g, '$1')
    if (s.trim()) out.push(s)
  }
  return out.join('\n')
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
}
