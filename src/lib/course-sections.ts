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
  /** Read from Concordia's instruction mode. Undefined when it says nothing
   *  useful — a guess here would put "in person" on an online class. */
  delivery?: 'in-person' | 'online' | 'online-async' | 'hybrid'
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
    delivery: deliveryOf(ordered),
  }
}

/** Concordia's instruction mode, narrowed to the three answers we store.
 *  Anything it does not clearly say stays undefined rather than defaulting. */
function deliveryOf(sections: SectionOption[]): SectionPatch['delivery'] {
  const modes = sections.map((s) => `${s.instructionMode ?? ''}`.toLowerCase()).filter(Boolean)
  if (modes.length === 0) return undefined
  const online = modes.filter((m) => /online|en ligne|remote|distance/.test(m)).length
  // Online AND no published time anywhere is asynchronous, which is a fact the
  // two together establish and neither states on its own.
  if (online === modes.length) {
    return sections.every((s) => !s.meetingTimes?.trim()) ? 'online-async' : 'online'
  }
  if (online > 0) return 'hybrid'
  if (modes.some((m) => /person|campus|présentiel|classroom/.test(m))) return 'in-person'
  return undefined
}

/**
 * The bare section letter, without the component code.
 *
 * A student's `section` is written the way the autofill builds it — "B LEC",
 * or "BB LEC · BI TUT" for a class with a tutorial — while an outline names
 * only the section it belongs to, "B". Comparing those as plain strings told a
 * student in section B that section B's own outline was "not yours", which is
 * the app contradicting the timetable it filled in itself two rows above.
 *
 * Takes the FIRST token, because the lecture is what people mean by "my
 * section" and it is what an outline is published against.
 */
export function sectionKey(section: string): string {
  const first = section.trim().split(/[·,;]/)[0]?.trim() ?? ''
  const token = first.split(/\s+/)[0] ?? ''
  return token.toUpperCase()
}

/** Do these two refer to the same section? Empty on either side is "unknown",
 *  which is never a mismatch — we do not warn on something we do not know. */
export function sameSection(a: string, b: string): boolean {
  const ka = sectionKey(a)
  const kb = sectionKey(b)
  return ka !== '' && kb !== '' && ka === kb
}
