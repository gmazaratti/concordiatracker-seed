import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AppDataContext,
  DEFAULT_CALENDAR_PREFS,
  DEFAULT_TODAY_PREFS,
  type CalendarPrefs,
  type CommunityView,
  type CoursesView,
  type TodayPrefs,
} from './app-data'
import { term } from '@/data/mock'
import { useAuth } from './auth'
import { useSupabaseProfile } from './useSupabaseProfile'
import { supabase, fireWrite } from '@/lib/supabase'
import {
  assessmentFromRow,
  assessmentPatchToRow,
  assessmentToInsert,
  blueprintToInsert,
  courseFromRow,
  courseToRow,
  taskFromRow,
  taskToInsert,
  type AssignmentRow,
  type CourseRow,
  type TodoRow,
} from '@/lib/supabase-adapters'
import { COURSE_COLORS } from '@/lib/course-color'
import { daysFromNow } from '@/lib/date'
import type { PeerCorrection } from '@/data/peer-corrections'
import type {
  Assessment,
  AssessmentStatus,
  CalendarTask,
  Course,
  Grade,
} from '@/data/types'

// Stable empty refs so a signed-out / loading state doesn't churn consumers.
const NO_COURSES: Course[] = []
const NO_ASSESSMENTS: Assessment[] = []
const NO_TASKS: CalendarTask[] = []

interface Loaded {
  ownerId: string
  courses: Course[]
  assessments: Assessment[]
  tasks: CalendarTask[]
}

/** The app's data store. Phase 3: courses + assessments are the signed-in user's
 * real Supabase rows (read on sign-in, every edit written through). Tasks / peer
 * corrections / reminders remain in-memory until their phases (4 / 11 / 8). */
export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const { user: authUser } = useAuth()
  // Phase 2: real profile + plan.
  const { user, plan, setPlan, updateProfile, onboardingCompleted, completeOnboarding, changeHandle } =
    useSupabaseProfile()

  // Phase 3: the loaded rows, tagged with their owner so a different user never
  // briefly sees the previous user's data (the derivation gates on ownerId).
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const dataReady = !!loaded && loaded.ownerId === authUser?.id
  const courses = dataReady ? loaded!.courses : NO_COURSES
  const assessments = dataReady ? loaded!.assessments : NO_ASSESSMENTS
  const personalTasks = dataReady ? loaded!.tasks : NO_TASKS
  // Signed in, but the first fetch for this user hasn't landed yet.
  const dataLoading = !!authUser && !dataReady

  const updateCourses = useCallback(
    (fn: (c: Course[]) => Course[]) => setLoaded((d) => (d ? { ...d, courses: fn(d.courses) } : d)),
    [],
  )
  const updateAssessments = useCallback(
    (fn: (a: Assessment[]) => Assessment[]) =>
      setLoaded((d) => (d ? { ...d, assessments: fn(d.assessments) } : d)),
    [],
  )
  const updateTasks = useCallback(
    (fn: (t: CalendarTask[]) => CalendarTask[]) =>
      setLoaded((d) => (d ? { ...d, tasks: fn(d.tasks) } : d)),
    [],
  )

  // Assessment writes are coalesced per-row + debounced, so per-keystroke title
  // / weight / notes edits become one DB update (and status+grade saved together
  // merge into one), instead of a request per change.
  const writeTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const writePending = useRef<Map<string, Record<string, unknown>>>(new Map())

  const flushAssessmentWrite = useCallback((id: string) => {
    const cols = writePending.current.get(id)
    writePending.current.delete(id)
    writeTimers.current.delete(id)
    if (cols && Object.keys(cols).length) {
      fireWrite(supabase.from('assignments').update(cols).eq('id', id))
    }
  }, [])

  const queueAssessmentWrite = useCallback(
    (id: string, cols: Record<string, unknown>) => {
      writePending.current.set(id, { ...(writePending.current.get(id) ?? {}), ...cols })
      const existing = writeTimers.current.get(id)
      if (existing) clearTimeout(existing)
      writeTimers.current.set(id, setTimeout(() => flushAssessmentWrite(id), 350))
    },
    [flushAssessmentWrite],
  )

  // Load the user's courses + assignments on sign-in.
  useEffect(() => {
    if (!authUser) return
    let active = true
    Promise.all([
      supabase.from('courses').select('*').eq('user_id', authUser.id),
      supabase.from('assignments').select('*').eq('user_id', authUser.id).eq('deleted', false),
      supabase.from('todos').select('*').eq('user_id', authUser.id),
    ]).then(([cRes, aRes, tRes]) => {
      if (!active) return
      setLoaded({
        ownerId: authUser.id,
        courses: ((cRes.data as CourseRow[]) ?? []).map(courseFromRow),
        assessments: ((aRes.data as AssignmentRow[]) ?? []).map(assessmentFromRow),
        tasks: ((tRes.data as TodoRow[]) ?? []).map(taskFromRow),
      })
    })
    return () => {
      active = false
    }
  }, [authUser])

  const [coursesView, setCoursesView] = useState<CoursesView>('grid')
  const [communityView, setCommunityView] = useState<CommunityView>('card')
  const [todayPrefs, setTodayPrefs] = useState<TodayPrefs>(DEFAULT_TODAY_PREFS)
  const [calendarPrefs, setCalendarPrefs] = useState<CalendarPrefs>(DEFAULT_CALENDAR_PREFS)
  const colorSeq = useRef(0)
  // In-memory until later phases.
  const [peerCorrections, setPeerCorrections] = useState<PeerCorrection[]>([])
  // "Remind me" subscriptions, backed by `event_reminders` (per-user, own-row RLS).
  const [reminderIds, setReminderIds] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    let active = true
    void (async () => {
      if (!authUser) {
        if (active) setReminderIds(new Set())
        return
      }
      const { data } = await supabase
        .from('event_reminders')
        .select('event_id')
        .eq('user_id', authUser.id)
      if (!active) return
      setReminderIds(new Set((data as { event_id: string }[] | null)?.map((r) => r.event_id) ?? []))
    })()
    return () => {
      active = false
    }
  }, [authUser])

  const toggleReminder = useCallback(
    (eventId: string) => {
      if (!authUser) return
      setReminderIds((prev) => {
        const next = new Set(prev)
        if (next.has(eventId)) {
          next.delete(eventId)
          fireWrite(
            supabase
              .from('event_reminders')
              .delete()
              .eq('user_id', authUser.id)
              .eq('event_id', eventId),
          )
        } else {
          next.add(eventId)
          fireWrite(
            supabase
              .from('event_reminders')
              .upsert({ user_id: authUser.id, event_id: eventId }, { onConflict: 'user_id,event_id' }),
          )
        }
        return next
      })
    },
    [authUser],
  )

  const updateTodayPrefs = useCallback(
    (patch: Partial<TodayPrefs>) => setTodayPrefs((p) => ({ ...p, ...patch })),
    [],
  )
  const updateCalendarPrefs = useCallback(
    (patch: Partial<CalendarPrefs>) => setCalendarPrefs((p) => ({ ...p, ...patch })),
    [],
  )

  // Personal calendar tasks → the `todos` table (insert DB-generated id, adopt it).
  const addTask = useCallback(
    async (task: { title: string; due: string; note?: string }) => {
      if (!authUser) return
      const { data } = await supabase
        .from('todos')
        .insert(taskToInsert(task, authUser.id))
        .select('*')
        .maybeSingle()
      if (data) updateTasks((list) => [...list, taskFromRow(data as TodoRow)])
    },
    [authUser, updateTasks],
  )
  const toggleTask = useCallback(
    (id: string) => {
      const t = personalTasks.find((x) => x.id === id)
      if (!t) return
      const done = !t.done
      updateTasks((list) => list.map((x) => (x.id === id ? { ...x, done } : x)))
      fireWrite(supabase.from('todos').update({ done }).eq('id', id))
    },
    [personalTasks, updateTasks],
  )
  const removeTask = useCallback(
    (id: string) => {
      updateTasks((list) => list.filter((t) => t.id !== id))
      fireWrite(supabase.from('todos').delete().eq('id', id))
    },
    [updateTasks],
  )

  // ── Assessment edits — optimistic local update + write-through to Supabase ──
  const setStatus = useCallback(
    (id: string, status: AssessmentStatus) => {
      updateAssessments((list) => list.map((a) => (a.id === id ? { ...a, status } : a)))
      queueAssessmentWrite(id, assessmentPatchToRow({ status }))
    },
    [updateAssessments, queueAssessmentWrite],
  )

  const setGrade = useCallback(
    (id: string, grade: Grade | null) => {
      updateAssessments((list) => list.map((a) => (a.id === id ? { ...a, grade } : a)))
      queueAssessmentWrite(id, assessmentPatchToRow({ grade }))
    },
    [updateAssessments, queueAssessmentWrite],
  )

  const setNotes = useCallback(
    (id: string, notes: string) => {
      updateAssessments((list) => list.map((a) => (a.id === id ? { ...a, notes } : a)))
      queueAssessmentWrite(id, { notes })
    },
    [updateAssessments, queueAssessmentWrite],
  )

  const updateAssessment = useCallback(
    (id: string, patch: Partial<Assessment>) => {
      updateAssessments((list) => list.map((a) => (a.id === id ? { ...a, ...patch } : a)))
      queueAssessmentWrite(id, assessmentPatchToRow(patch))
    },
    [updateAssessments, queueAssessmentWrite],
  )

  // Insert new assessments (the DB generates the uuid ids; we adopt them back).
  const addAssessments = useCallback(
    async (items: Assessment[]) => {
      if (!authUser || items.length === 0) return
      const rows = items.map((a) => assessmentToInsert(a, authUser.id))
      const { data } = await supabase.from('assignments').insert(rows).select('*')
      if (data) updateAssessments((list) => [...list, ...(data as AssignmentRow[]).map(assessmentFromRow)])
    },
    [authUser, updateAssessments],
  )

  const removeAssessment = useCallback(
    (id: string) => {
      // Cancel any pending edit-write for this row before deleting it.
      const t = writeTimers.current.get(id)
      if (t) clearTimeout(t)
      writeTimers.current.delete(id)
      writePending.current.delete(id)
      updateAssessments((list) => list.filter((a) => a.id !== id))
      fireWrite(supabase.from('assignments').delete().eq('id', id))
    },
    [updateAssessments],
  )

  const setCourseColor = useCallback(
    (id: string, color: string) => {
      updateCourses((list) => list.map((c) => (c.id === id ? { ...c, color } : c)))
      fireWrite(supabase.from('courses').update({ color }).eq('id', id))
    },
    [updateCourses],
  )

  const updateCourse = useCallback(
    (id: string, patch: Partial<Course>) => {
      updateCourses((list) => list.map((c) => (c.id === id ? { ...c, ...patch } : c)))
      fireWrite(supabase.from('courses').update(courseToRow(patch)).eq('id', id))
    },
    [updateCourses],
  )

  // Course creation — insert a course (DB-generated id), adopt it. Blank for a
  // manual add; pre-filled code/title/section when added from a blueprint.
  const createCourse = useCallback(
    async (init?: { code?: string; title?: string; section?: string }) => {
      if (!authUser) return ''
      const color = COURSE_COLORS[colorSeq.current % COURSE_COLORS.length].id
      colorSeq.current += 1
      const { data } = await supabase
        .from('courses')
        .insert({
          user_id: authUser.id,
          code: init?.code ?? '',
          name: init?.title ?? '',
          term: term.name,
          credits: 3,
          color,
          section: init?.section ?? '',
          professor: '',
          prof_email: '',
          location: '',
          time: '',
          syllabus_url: '',
          origin: 'manual',
        })
        .select('*')
        .maybeSingle()
      if (!data) return ''
      const course = courseFromRow(data as CourseRow)
      updateCourses((list) => [...list, course])
      return course.id
    },
    [authUser, updateCourses],
  )

  // Delete a course and its assessments. Assignments go first (the FK references
  // the course) so the course delete can't be blocked.
  const removeCourse = useCallback(
    async (id: string) => {
      updateCourses((list) => list.filter((c) => c.id !== id))
      updateAssessments((list) => list.filter((a) => a.courseId !== id))
      await supabase.from('assignments').delete().eq('course_id', id)
      fireWrite(supabase.from('courses').delete().eq('id', id))
    },
    [updateCourses, updateAssessments],
  )

  // OPT-IN share: publish this course's current outline to the shared blueprint
  // pool (the only path that writes there — courses are private by default).
  const shareCourseAsBlueprint = useCallback(
    async (courseId: string) => {
      if (!authUser) return
      const course = courses.find((c) => c.id === courseId)
      if (!course) return
      const items = assessments.filter((a) => a.courseId === courseId)
      await supabase
        .from('shared_blueprints')
        .insert(blueprintToInsert({ userId: authUser.id, course, author: user.name, assessments: items }))
    },
    [authUser, courses, assessments, user.name],
  )

  // A blank, SELF-ENTERED assessment for the manual editor (unverified provenance).
  const addBlankAssessment = useCallback(
    async (courseId: string) => {
      if (!authUser) return
      const blank: Assessment = {
        id: '',
        courseId,
        title: '',
        kind: 'assignment',
        due: daysFromNow(14, 23, 59),
        weight: 0,
        provenance: { status: 'unverified' },
        status: 'not-started',
        grade: null,
        notes: '',
      }
      const { data } = await supabase
        .from('assignments')
        .insert(assessmentToInsert(blank, authUser.id))
        .select('*')
        .maybeSingle()
      if (data) updateAssessments((list) => [...list, assessmentFromRow(data as AssignmentRow)])
    },
    [authUser, updateAssessments],
  )

  const courseById = useCallback(
    (id: string): Course | undefined => courses.find((c) => c.id === id),
    [courses],
  )

  // Peer-correction stub (Phase 11 — empty against real data). Local-only.
  const applyPeerCorrection = useCallback(
    (assessmentId: string) => {
      const c = peerCorrections.find((x) => x.assessmentId === assessmentId)
      if (!c) return
      updateAssessment(assessmentId, {
        due: c.proposedDue,
        provenance: { status: 'confirmed', confirmations: c.changedCount },
      })
      setPeerCorrections((list) => list.filter((x) => x.assessmentId !== assessmentId))
    },
    [peerCorrections, updateAssessment],
  )

  const dismissPeerCorrection = useCallback((assessmentId: string) => {
    setPeerCorrections((list) => list.filter((x) => x.assessmentId !== assessmentId))
  }, [])

  const value = useMemo(
    () => ({
      user,
      plan,
      setPlan,
      updateProfile,
      onboardingCompleted,
      completeOnboarding,
      changeHandle,
      courses,
      assessments,
      dataLoading,
      setStatus,
      setGrade,
      setNotes,
      updateAssessment,
      addAssessments,
      removeAssessment,
      setCourseColor,
      updateCourse,
      createCourse,
      removeCourse,
      shareCourseAsBlueprint,
      addBlankAssessment,
      courseById,
      coursesView,
      setCoursesView,
      communityView,
      setCommunityView,
      todayPrefs,
      updateTodayPrefs,
      personalTasks,
      addTask,
      toggleTask,
      removeTask,
      isReminderSet: (eventId: string) => reminderIds.has(eventId),
      toggleReminder,
      calendarPrefs,
      updateCalendarPrefs,
      peerCorrections,
      applyPeerCorrection,
      dismissPeerCorrection,
    }),
    [
      user,
      plan,
      setPlan,
      updateProfile,
      onboardingCompleted,
      completeOnboarding,
      changeHandle,
      courses,
      assessments,
      dataLoading,
      setStatus,
      setGrade,
      setNotes,
      updateAssessment,
      addAssessments,
      removeAssessment,
      setCourseColor,
      updateCourse,
      createCourse,
      removeCourse,
      shareCourseAsBlueprint,
      addBlankAssessment,
      courseById,
      coursesView,
      communityView,
      todayPrefs,
      updateTodayPrefs,
      personalTasks,
      addTask,
      toggleTask,
      removeTask,
      reminderIds,
      toggleReminder,
      calendarPrefs,
      updateCalendarPrefs,
      peerCorrections,
      applyPeerCorrection,
      dismissPeerCorrection,
    ],
  )

  return <AppDataContext value={value}>{children}</AppDataContext>
}
