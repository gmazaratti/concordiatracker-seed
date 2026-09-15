const SEASON_RANK: Record<string, number> = {
  winter: 1,
  spring: 2,
  summer: 3,
  fall: 4,
  autumn: 4,
}

/**
 * A sortable rank for a term string like "Summer 2026" — year-major, season-minor
 * in academic order (Winter < Spring < Summer < Fall). Higher = more recent, so
 * sort descending for newest-first. Unparseable terms rank 0 (sort last).
 */
/**
 * One spelling for a term, whatever was typed or parsed.
 *
 * Terms reach the database from three places — a canonical dropdown, the
 * catalogue, and the SYLLABUS PARSER reading whatever the PDF says — and the
 * third one writes free text. Production currently holds "Summer 2026" AND
 * "SUMMER 2026", "Fall 2026" AND "FALL 2026", and one "Automne 2026" from a
 * French outline.
 *
 * That is not cosmetic. Term is matched by STRING EQUALITY in several places:
 * the Courses term tabs group by it, `sortTermsDesc` orders by it, the GPA
 * panel buckets by it, and `termRank` parses the season word out of it. A
 * course filed as "FALL 2026" silently lands in its own tab, sorts wrong, and
 * never joins the term it belongs to.
 *
 * Unrecognisable input is returned TRIMMED but otherwise untouched: a term we
 * cannot parse is still the student's own text and better shown as typed than
 * replaced with a guess.
 */
const SEASON_WORDS: Record<string, string> = {
  fall: 'Fall', automne: 'Fall', autumn: 'Fall',
  winter: 'Winter', hiver: 'Winter',
  summer: 'Summer', ete: 'Summer', été: 'Summer',
  spring: 'Spring', printemps: 'Spring',
}

export function normalizeTerm(term: string | null | undefined): string {
  const raw = (term ?? '').trim().replace(/\s+/g, ' ')
  if (!raw) return ''
  const m = /^([A-Za-zÀ-ÿ]+)[\s/-]+(\d{4})$/.exec(raw)
  if (!m) return raw
  const season = SEASON_WORDS[m[1].toLowerCase()]
  return season ? `${season} ${m[2]}` : raw
}

export function termRank(term: string): number {
  const m = term.trim().match(/([A-Za-z]+)\s+(\d{4})/)
  if (!m) return 0
  const season = SEASON_RANK[m[1].toLowerCase()] ?? 0
  return parseInt(m[2], 10) * 10 + season
}

/** Unique term names, most recent first (unparseable ones sort last). */
export function sortTermsDesc(terms: string[]): string[] {
  return [...new Set(terms.filter(Boolean))].sort((a, b) => termRank(b) - termRank(a))
}

/** Is `a` strictly earlier than `b` in academic order? */
export function isTermBefore(a: string, b: string): boolean {
  return termRank(a) < termRank(b)
}
