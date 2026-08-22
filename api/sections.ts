/**
 * GET/POST /api/sections?subject=COMP&catalog=248
 *
 * Section lookup for the seat-watch picker. This exists as a server route
 * purely so the Concordia key never reaches a browser — the client asks us, we
 * ask Concordia. It also lets us collapse the per-meeting-pattern rows and
 * return only the fields the picker needs, rather than shipping the raw payload.
 */
import { bySection, fetchSchedule, meetingTimeString, num } from './_concordia.js'
import { fail } from './_respond.js'

export interface SectionOption {
  classNumber: string
  termCode: string
  section: string
  courseTitle: string
  /** LEC / TUT / LAB — separate capacities, so this is part of the identity. */
  component: string
  componentLabel: string
  /** "Mon · Wed 10:15–11:30", ready for course.meetingTimes. */
  meetingTimes: string | null
  enrolled: number | null
  capacity: number | null
  waitlisted: number | null
  waitlistCap: number | null
  hasReserved: boolean
  /** Campus — SGW or LOY. */
  location: string
  instructionMode: string
  building: string
  room: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any) {
  const q = req.query ?? {}
  const subject = String(q.subject ?? '').trim().toUpperCase()
  const catalog = String(q.catalog ?? '').trim()

  if (!/^[A-Z]{2,6}$/.test(subject) || !/^[0-9]{2,4}[A-Z]?$/.test(catalog)) {
    fail(res, 400, 'Give a subject and catalog number, e.g. COMP 248.')
    return
  }

  try {
    const rows = await fetchSchedule(subject, catalog)
    // Newest term first — the one a student is registering for.
    const options: SectionOption[] = [...bySection(rows).values()]
      .map((r) => ({
        classNumber: r.classNumber,
        termCode: r.termCode,
        section: r.section,
        courseTitle: r.courseTitle,
        component: r.componentCode ?? '',
        componentLabel: r.componentDescription ?? '',
        meetingTimes: meetingTimeString(r),
        enrolled: num(r.currentEnrollment),
        capacity: num(r.enrollmentCapacity),
        waitlisted: num(r.currentWaitlistTotal),
        waitlistCap: num(r.waitlistCapacity),
        hasReserved: r.hasSeatReserved === 'Y',
        location: r.locationCode ?? '',
        instructionMode: r.instructionModeDescription ?? '',
        building: r.buildingCode ?? '',
        room: r.room ?? '',
      }))
      .sort((a, b) => (b.termCode === a.termCode ? a.section.localeCompare(b.section) : b.termCode.localeCompare(a.termCode)))

    res.status(200).json({ subject, catalog, sections: options })
  } catch (err) {
    fail(res, 502, err instanceof Error ? err.message : 'Could not reach the course directory.', {
      code: 'upstream_error',
      hint: 'Concordia’s course directory did not answer. Retry in a minute.',
    })
  }
}
