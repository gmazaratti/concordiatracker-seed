import type { SectionOption } from '@/lib/seats'

/**
 * Turning a course into its real Concordia sections.
 *
 * The seat watcher already fetches sections; this is the other thing that data
 * is good for. A student who has typed "COMP 248" has told us enough to look up
 * when it actually meets, instead of making them copy it out of the portal.
 */

/** "COMP 248", "comp248", "COMP-248" → { subject, catalog }. */
export function parseCourseCode(code: string): { subject: string; catalog: string } | null {
  const m = code.trim().toUpperCase().match(/^([A-Z]{2,6})[\s-]*(\d{2,4}[A-Z]?)$/)
  if (!m) return null
  return { subject: m[1], catalog: m[2] }
}

/**
 * Term codes sort chronologically as plain numbers: within a year the season
 * digit runs 1 (Summer) < 2 (Fall) < 4 (Winter), and Winter belongs to the
 * academic year that began the previous autumn. So the largest code is the
 * furthest-ahead term, which is the one someone is registering for.
 */
export function newestTerm(sections: SectionOption[]): string | null {
  let best: string | null = null
  for (const s of sections) if (best === null || s.termCode > best) best = s.termCode
  return best
}

/**
 * The inverse of `termLabel`: "Fall 2026" -> "2262".
 *
 * Needed because a course carries the term as a NAME (what the student picked)
 * while Concordia's sections carry it as a CODE. Without the mapping the section
 * picker defaulted to whatever term happened to sort highest, so choosing Fall
 * and then asking for its schedule offered Winter.
 *
 * Winter belongs to the academic year that began the previous autumn, so its
 * code year is one behind its name.
 */
export function termCodeFor(termName: string): string | null {
  const m = termName.trim().match(/^(Winter|Summer|Fall)\s+(\d{4})$/i)
  if (!m) return null
  const season = m[1][0].toUpperCase() + m[1].slice(1).toLowerCase()
  const digit: Record<string, string> = { Summer: '1', Fall: '2', Winter: '4' }
  const d = digit[season]
  if (!d) return null
  const year = Number(m[2]) - (season === 'Winter' ? 1 : 0)
  if (year < 2000 || year > 2099) return null
  return `2${String(year).slice(2)}${d}`
}

/** Component order for display: the lecture is what people mean by "my class". */
const COMPONENT_RANK: Record<string, number> = { LEC: 0, TUT: 1, LAB: 2 }

export function sortSections(sections: SectionOption[]): SectionOption[] {
  return [...sections].sort((a, b) => {
    const ra = COMPONENT_RANK[a.component] ?? 9
    const rb = COMPONENT_RANK[b.component] ?? 9
    if (ra !== rb) return ra - rb
    return a.section.localeCompare(b.section)
  })
}

export interface SectionPatch {
  section: string
  meetingTimes: string
  location: string
  /** The calendar's own title for the course. Filled because we have it, and a
   *  student should never retype something the university already published. */
  title: string
}

/**
 * Turn the chosen sections into the three fields the course panel holds.
 *
 * Meeting patterns join with ";" because that is what `parseMeetingTimes`
 * splits on, so a lecture and its tutorial both reach the Next class widget.
 * Component codes deliberately stay OUT of that string: the parser reads the
 * text before the time as days, and "LEC Mon" is not a day. They live in the
 * section field instead, where they belong anyway.
 *
 * A section with no building falls back to how it is delivered — "Online" is a
 * real answer to "where is this", and a blank field reads as missing data rather
 * than as a class that has no room.
 *
 * The instructor is NOT here, and cannot be. Concordia's published schedule
 * carries the class number, the times, the room, the mode and the seat counts,
 * and no teaching staff at all. Inventing one would be the worst kind of wrong:
 * plausible, unverifiable, and attached to a real person's name.
 */
export function sectionPatch(chosen: SectionOption[]): SectionPatch {
  const ordered = sortSections(chosen)
  const place = (s: SectionOption) =>
    s.building && s.room ? `${s.building} ${s.room}` : s.location || s.instructionMode || ''
  return {
    section: ordered.map((s) => `${s.section} ${s.component}`.trim()).join(' · '),
    meetingTimes: ordered
      .map((s) => s.meetingTimes)
      .filter((t): t is string => !!t)
      .join('; '),
    location: [...new Set(ordered.map(place))].filter(Boolean).join(' · '),
    title: ordered.find((s) => s.courseTitle)?.courseTitle ?? '',
  }
}
