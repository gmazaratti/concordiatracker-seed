import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { Assessment, Course } from '@/data/types'
import { assessmentFromRow, courseFromRow, type AssignmentRow, type CourseRow } from '@/lib/supabase-adapters'
import { guardianView, myGuardedStudents, type GuardedStudent } from '@/lib/guardians'

/**
 * The family view's data: one student's courses and assessments, read through
 * guardian_view (db/guardian_view_rows.sql) and run through the APP'S OWN row
 * adapters, so every grade, GPA and due label is computed exactly as the
 * student sees it. Grades arrive stripped unless the student shares them.
 */
export interface FamilyData {
  name: string
  avatar: string | null
  grades: boolean
  schedule: boolean
  courses: Course[]
  /** Finished courses (for the GPA), kept apart like the app's pastCourses. */
  pastCourses: Course[]
  assessments: Assessment[]
  schedules: { name: string; term_code: string | null; sections: unknown }[]
}

/** The students this person can see, and which one is picked (?student=). */
export function useGuarded() {
  const [students, setStudents] = useState<GuardedStudent[] | null>(null)
  const [params, setParams] = useSearchParams()
  useEffect(() => {
    let alive = true
    void myGuardedStudents().then((s) => alive && setStudents(s))
    return () => {
      alive = false
    }
  }, [])
  const wanted = params.get('student')
  const current = students?.find((s) => s.student === wanted) ?? students?.[0] ?? null
  const pick = (id: string) =>
    setParams((p) => {
      const n = new URLSearchParams(p)
      n.set('student', id)
      return n
    })
  return { students, current, pick }
}

const cache = new Map<string, FamilyData>()

export function useFamilyData(student: string | null) {
  const [data, setData] = useState<FamilyData | null>(student ? (cache.get(student) ?? null) : null)
  const [error, setError] = useState('')
  useEffect(() => {
    if (!student) return
    let alive = true
    guardianView(student)
      .then((raw) => {
        const rows = raw as unknown as {
          name: string
          avatar: string | null
          grades: boolean
          schedule: boolean
          course_rows: CourseRow[]
          assignment_rows: AssignmentRow[]
          schedules: FamilyData['schedules']
        }
        const all = (rows.course_rows ?? []).map(courseFromRow)
        const next: FamilyData = {
          name: rows.name,
          avatar: rows.avatar ?? null,
          grades: rows.grades,
          schedule: rows.schedule,
          courses: all.filter((c) => !c.archived),
          pastCourses: all.filter((c) => c.archived),
          assessments: (rows.assignment_rows ?? []).map(assessmentFromRow),
          schedules: rows.schedules ?? [],
        }
        cache.set(student, next)
        if (alive) setData(next)
      })
      .catch((e: Error) => alive && setError(e.message))
    return () => {
      alive = false
    }
  }, [student])
  return { data: student && data ? data : null, error }
}

/** Assessments grouped by course id. */
export function useByCourse(assessments: Assessment[]) {
  return useMemo(() => {
    const m = new Map<string, Assessment[]>()
    for (const a of assessments) {
      const l = m.get(a.courseId)
      if (l) l.push(a)
      else m.set(a.courseId, [a])
    }
    return m
  }, [assessments])
}
