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
}

/**
 * Turn the chosen sections into the three fields the course panel holds.
 *
 * Meeting patterns join with ";" because that is what `parseMeetingTimes`
 * splits on, so a lecture and its tutorial both reach the Next class widget.
 * Component codes deliberately stay OUT of that string: the parser reads the
 * text before the time as days, and "LEC Mon" is not a day. They live in the
 * section field instead, where they belong anyway.
 */
export function sectionPatch(chosen: SectionOption[]): SectionPatch {
  const ordered = sortSections(chosen)
  return {
    section: ordered.map((s) => `${s.section} ${s.component}`.trim()).join(' · '),
    meetingTimes: ordered
      .map((s) => s.meetingTimes)
      .filter((t): t is string => !!t)
      .join('; '),
    location: [...new Set(ordered.map((s) => s.building && s.room ? `${s.building} ${s.room}` : ''))]
      .filter(Boolean)
      .join(' · '),
  }
}
