import { useEffect, useMemo, useState } from 'react'
import { useAppData } from '@/app/providers/app-data'
import { loadAcademicProfile, summarizeRecord } from '@/lib/academic-record'
import { buildRecordSnapshot, type RecordSnapshot } from '@/lib/record-export'

/**
 * Your record, in the one shape everything that leaves the app speaks.
 *
 * A hook rather than a helper because it needs the store AND the two columns
 * the planner keeps separately (year, minor). Three surfaces want the same
 * object — the export sheet, the chat's + menu, and a `?attach=record` deep
 * link — and building it three times is three chances for the sent copy to
 * disagree with the printed one.
 *
 * `null` until the academic profile has loaded, so nothing ever sends a record
 * that claims you are in no year.
 */
export function useRecordSnapshot(): RecordSnapshot | null {
  const { pastCourses, assessments, user } = useAppData()
  const [extra, setExtra] = useState<{ year: number | null; minor: string | null } | null>(null)

  useEffect(() => {
    let alive = true
    void loadAcademicProfile().then((p) => {
      if (alive) setExtra({ year: p.yearOfStudy, minor: p.minor ?? null })
    })
    return () => {
      alive = false
    }
  }, [])

  const summary = useMemo(
    () => summarizeRecord(pastCourses, assessments),
    [pastCourses, assessments],
  )

  return useMemo(() => {
    if (!extra) return null
    return buildRecordSnapshot({
      name: user.name || (user.handle ? `@${user.handle}` : 'My record'),
      handle: user.handle,
      program: user.program,
      year: extra.year,
      minor: extra.minor,
      pastCourses,
      summary,
    })
  }, [extra, user.name, user.handle, user.program, pastCourses, summary])
}
