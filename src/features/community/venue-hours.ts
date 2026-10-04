/**
 * Which of a venue's hour lines applies today.
 *
 * Lines are written by hand, one per row, as "Monday–Wednesday · 10am–11pm" or
 * "Saturday · closed": a day or a day range, a separator, then whatever the
 * venue says about those days. Only the DAYS are read; the right-hand side is
 * shown exactly as written, because "private events only" is a real answer and
 * an opening time parsed wrong is a worse one than none.
 *
 * Anything that does not start with a recognisable day returns null, and the
 * caller just shows the full list.
 */
const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

function dayIndex(word: string): number {
  const w = word.trim().toLowerCase()
  if (w.length < 3) return -1
  return DAYS.findIndex((d) => d.startsWith(w))
}

export function hoursForDay(lines: string[], day: number): string | null {
  for (const line of lines) {
    const sep = line.search(/\s[·:|]\s|:\s/)
    if (sep < 0) continue
    const daysPart = line.slice(0, sep)
    const rest = line.slice(sep).replace(/^\s*[·:|]\s*/, '').trim()
    if (!rest) continue
    const [fromWord, toWord] = daysPart.split(/\s*[–—-]\s*|\s+to\s+/i)
    const from = dayIndex(fromWord ?? '')
    if (from < 0) continue
    const to = toWord ? dayIndex(toWord) : from
    if (to < 0) continue
    // A range may wrap past Saturday ("Friday–Sunday").
    const inRange = from <= to ? day >= from && day <= to : day >= from || day <= to
    if (inRange) return rest
  }
  return null
}
