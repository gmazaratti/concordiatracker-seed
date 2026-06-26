import { term } from '@/data/mock'
import { COURSE_COLORS } from '@/lib/course-color'
import { daysFromNow } from '@/lib/date'
import type { Assessment, Course } from '@/data/types'

/**
 * A throwaway sandbox class the guided tour points at, so the walkthrough NEVER
 * touches the user's real courses/assignments (and works the same for a brand-new
 * empty account). It's merged into the app data only while the tour runs, then
 * removed; all writes to these ids are no-ops (see AppDataProvider). Ids are
 * prefixed `sample-` — `isSampleId` is the single guard.
 */
export const SAMPLE_COURSE_ID = 'sample-course'

export const isSampleId = (id: string): boolean => id.startsWith('sample-')

export const SAMPLE_COURSE: Course = {
  id: SAMPLE_COURSE_ID,
  code: 'DEMO 101',
  title: 'Sample Course · just for the tour',
  term: term.name,
  credits: 3,
  color: COURSE_COLORS[4].id,
  section: 'AA',
  instructor: { name: 'Prof. Avery Reed', email: 'a.reed@example.edu' },
  ta: { name: 'Jordan Kim', email: 'j.kim@example.edu' },
  location: 'MB 3.430',
  meetingTimes: 'Mon · Wed 10:15–11:30',
  officeHours: 'Tue 14:00–16:00 · MB 12.225',
  syllabusUrl: '',
}

const graded = (percent: number): Assessment['grade'] => ({
  mode: 'percent',
  percent,
  earned: null,
  total: null,
})

export const SAMPLE_ASSESSMENTS: Assessment[] = [
  {
    id: 'sample-a1',
    courseId: SAMPLE_COURSE_ID,
    title: 'Quiz 1',
    kind: 'quiz',
    due: daysFromNow(-14, 23, 59),
    weight: 15,
    provenance: { status: 'official' },
    status: 'done',
    grade: graded(88),
    notes: '',
  },
  {
    id: 'sample-a2',
    courseId: SAMPLE_COURSE_ID,
    title: 'Midterm',
    kind: 'midterm',
    due: daysFromNow(-5, 14, 0),
    weight: 30,
    provenance: { status: 'official' },
    status: 'done',
    grade: graded(76),
    notes: '',
  },
  {
    id: 'sample-a3',
    courseId: SAMPLE_COURSE_ID,
    title: 'Assignment 2',
    kind: 'assignment',
    due: daysFromNow(3, 23, 59),
    weight: 20,
    provenance: { status: 'confirmed', confirmations: 9 },
    status: 'not-started',
    grade: null,
    notes: '',
  },
  {
    id: 'sample-a4',
    courseId: SAMPLE_COURSE_ID,
    title: 'Final Exam',
    kind: 'final',
    due: daysFromNow(30, 9, 0),
    weight: 35,
    provenance: { status: 'official' },
    status: 'not-started',
    grade: null,
    notes: '',
  },
]
