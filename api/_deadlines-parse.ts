/**
 * The registrar's "Term dates and deadlines" page → per-section deadlines.
 *
 * https://www.concordia.ca/students/registration/term-dates-deadlines.html
 * carries two kinds of table per term:
 *   STANDARD  — one row per session ("Fall 2026 (Session 12W)") with the last
 *               day to add, DNE (full refund) and DISC (academic withdrawal).
 *               Every ordinary section follows these.
 *   SECTION   — "Non-standard fall term #2262": Subject | Catalog | Section |
 *               Start | End | Registration | DNE | DISC, for the sections that
 *               do NOT follow the standard dates (intensives, 6-week blocks,
 *               graduate modules). These are the dates a student is most likely
 *               to get wrong, because the generic ones look authoritative.
 *
 * Both are stored, because a student needs whichever applies to THEIR section,
 * and "no row for my section" only means "use the standard row" if the
 * standard row is there too.
 *
 * IMPORT-FREE ON PURPOSE: the cron (api/_sync-deadlines.ts) and the one-off
 * seeding script (scripts/sync-deadlines.mjs) both import this file, and Node
 * cannot resolve the `.js` specifiers the API uses from a plain script. Tests:
 * api/_deadlines-parse.test.mjs.
 *
 * FAILS CLOSED: a row whose dates cannot be read is dropped, and a page that
 * yields nothing writes nothing (see writeDeadlines).
 */

export type DeadlineKind = 'standard' | 'section'

export interface DeadlineRow {
  term_code: string
  kind: DeadlineKind
  /** '' for standard rows. */
  subject: string
  catalog: string
  section: string
  /** Standard rows: the registrar's own session label. '' for section rows. */
  session: string
  /** Summer standard rows say which sections they govern ("begin with 4, A, EC"). */
  section_prefixes: string[] | null
  start_date: string | null
  end_date: string | null
  registration: string | null
  dne: string | null
  disc: string | null
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
}
const pad = (n: number) => String(n).padStart(2, '0')

const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()

function month(word: string): number | null {
  return MONTHS[word.slice(0, 3).toLowerCase()] ?? null
}

/** "Thursday, September 10, 2026" / "Sept. 21, 2026**" / "May 19, 2026" → ISO date. */
export function parseDate(s: string): string | null {
  const m = s.match(/([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})/)
  if (!m) return null
  const mo = month(m[1])
  const d = Number(m[2])
  if (!mo || d < 1 || d > 31) return null
  return `${m[3]}-${pad(mo)}-${pad(d)}`
}

/** "Sept. 8–Dec. 7, 2026" / "May 11 – June 22, 2026" / "Jan. 11–April 12, 2027". */
export function parseSpan(s: string): { from: string; to: string } | null {
  const m = s.match(/([A-Za-z]{3,9})\.?\s+(\d{1,2})\s*[–—-]\s*(?:([A-Za-z]{3,9})\.?\s+)?(\d{1,2}),?\s+(\d{4})/)
  if (!m) return null
  const m1 = month(m[1])
  const m2 = month(m[3] ?? m[1])
  if (!m1 || !m2) return null
  const y = Number(m[5])
  // "Sept. 8–April 12, 2027" is a fall/winter span: the start is the year before.
  const y1 = m2 < m1 ? y - 1 : y
  return { from: `${y1}-${pad(m1)}-${pad(Number(m[2]))}`, to: `${y}-${pad(m2)}-${pad(Number(m[4]))}` }
}

/** Every "<season> term #NNNN" the page names → season → code. */
export function termCodes(page: string): Record<string, string> {
  const out: Record<string, string> = {}
  const t = text(page).toLowerCase()
  for (const m of t.matchAll(/(fall\/winter|fall|winter|summer)\s+term\s+(?:is\s+)?#(\d{4})/g)) {
    if (!out[m[1]]) out[m[1]] = m[2]
  }
  return out
}

function seasonOf(label: string): string | null {
  const l = label.toLowerCase()
  if (/fall\s*\/\s*winter/.test(l)) return 'fall/winter'
  if (/^fall/.test(l)) return 'fall'
  if (/^winter/.test(l)) return 'winter'
  if (/^(may|june|july|august|summer)/.test(l)) return 'summer'
  return null
}

/** 'Sections begin with “4” and “A” and "EC"' → ['4', 'A', 'EC']. */
function prefixes(label: string): string[] | null {
  const i = label.toLowerCase().indexOf('sections begin with')
  if (i < 0) return null
  const found = [...label.slice(i).matchAll(/[“"']([A-Za-z0-9]{1,3})[”"']/g)].map((m) => m[1].toUpperCase())
  return found.length ? [...new Set(found)] : null
}

const rowsOf = (table: string) =>
  (table.match(/<tr[\s\S]*?<\/tr>/g) ?? []).map((r) => (r.match(/<t[hd][^>]*>[\s\S]*?<\/t[hd]>/g) ?? []).map(text))

export function parseDeadlinesPage(page: string): DeadlineRow[] {
  const html = page.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '')
  const codes = termCodes(html)
  const out: DeadlineRow[] = []
  const re = /<table[\s\S]*?<\/table>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) {
    const rows = rowsOf(m[0])
    const header = (rows[0] ?? []).map((c) => c.toLowerCase())

    if (header[0] === 'subject' && header[1] === 'catalog' && header[2] === 'section') {
      // The term is the nearest "#NNNN" above the table. Fall and winter name
      // it in their own heading ("Non-standard fall term #2262"); summer's just
      // says "Non-standard dates" and inherits the "#2261" from the section's
      // intro further up, so this looks back through the whole page.
      const before = text(html.slice(0, m.index))
      const code = [...before.matchAll(/#(\d{4})/g)].pop()?.[1]
      if (!code) continue
      for (const r of rows.slice(1)) {
        if (r.length < 8 || !/^[A-Z]{3,4}$/.test(r[0]) || !r[1]) continue
        const row: DeadlineRow = {
          term_code: code,
          kind: 'section',
          subject: r[0],
          catalog: r[1].toUpperCase(),
          section: r[2].toUpperCase(),
          session: '',
          section_prefixes: null,
          start_date: parseDate(r[3]),
          end_date: parseDate(r[4]),
          registration: parseDate(r[5]),
          dne: parseDate(r[6]),
          disc: parseDate(r[7]),
        }
        if (row.dne || row.disc || row.registration) out.push(row)
      }
      continue
    }

    if (header[0] === 'term') {
      for (const r of rows.slice(1)) {
        if (r.length < 6) continue
        const season = seasonOf(r[0])
        const code = season ? codes[season] : undefined
        if (!code) continue
        const span = parseSpan(r[1])
        const row: DeadlineRow = {
          term_code: code,
          kind: 'standard',
          subject: '',
          catalog: '',
          section: '',
          session: r[0].replace(/\s*Sections begin with[\s\S]*$/i, '').trim(),
          section_prefixes: prefixes(r[0]),
          start_date: span?.from ?? null,
          end_date: span?.to ?? null,
          registration: parseDate(r[3]),
          dne: parseDate(r[4]),
          disc: parseDate(r[5]),
        }
        if (row.dne || row.disc || row.registration) out.push(row)
      }
    }
  }
  // The same section can appear twice if the page repeats a table; keep one.
  const seen = new Set<string>()
  return out.filter((r) => {
    const k = [r.term_code, r.kind, r.subject, r.catalog, r.section, r.session].join('|')
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

/** The slice of a Supabase client writeDeadlines needs, so this file imports nothing. */
export interface DeadlineWriter {
  from(table: string): {
    upsert(rows: unknown[], opts: { onConflict: string }): PromiseLike<{ error: { message: string } | null }>
    delete(): {
      eq(col: string, v: string): { lt(col: string, v: string): PromiseLike<{ error: { message: string } | null }> }
    }
  }
}

/**
 * Upsert every row, then remove rows of THE SAME TERMS that this run did not
 * see (a section the registrar took off the page). Terms absent from this
 * parse are left alone, and nothing is written when the parse is empty: a
 * page that failed to load must not wipe a term we already hold.
 */
export async function writeDeadlines(
  db: DeadlineWriter,
  rows: DeadlineRow[],
): Promise<{ written: number; perTerm: Record<string, { standard: number; section: number }> }> {
  const perTerm: Record<string, { standard: number; section: number }> = {}
  for (const r of rows) {
    perTerm[r.term_code] ??= { standard: 0, section: 0 }
    perTerm[r.term_code][r.kind]++
  }
  if (rows.length === 0) return { written: 0, perTerm }
  const runAt = new Date().toISOString()
  const stamped = rows.map((r) => ({ ...r, synced_at: runAt }))
  const up = await db
    .from('section_deadlines')
    .upsert(stamped, { onConflict: 'term_code,kind,subject,catalog,section,session' })
  if (up.error) throw new Error(up.error.message)
  for (const term of Object.keys(perTerm)) {
    const del = await db.from('section_deadlines').delete().eq('term_code', term).lt('synced_at', runAt)
    if (del.error) throw new Error(del.error.message)
  }
  return { written: rows.length, perTerm }
}

export const DEADLINES_PAGE = 'https://www.concordia.ca/students/registration/term-dates-deadlines.html'
