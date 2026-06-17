import { useCallback, useMemo, useRef, useState } from 'react'
import {
  AppDataContext,
  DEFAULT_CALENDAR_PREFS,
  DEFAULT_TODAY_PREFS,
  type CalendarPrefs,
  type CoursesView,
  type TodayPrefs,
} from './app-data'
import {
  courses as seedCourses,
  currentUser,
  seedAssessments,
  seedTasks,
} from '@/data/mock'
import { seedPeerCorrections, type PeerCorrection } from '@/data/peer-corrections'
import type {
  Assessment,
  AssessmentStatus,
  CalendarTask,
  Course,
  Grade,
  Plan,
} from '@/data/types'

/** Holds the cloned seed so UI mutations never touch the module-level data. */
export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const [plan, setPlan] = useState<Plan>(currentUser.plan)
  const [courses, setCourses] = useState<Course[]>(() =>
    seedCourses.map((c) => ({ ...c })),
  )
  const [coursesView, setCoursesView] = useState<CoursesView>('grid')
  const [todayPrefs, setTodayPrefs] = useState<TodayPrefs>(DEFAULT_TODAY_PREFS)
  const [calendarPrefs, setCalendarPrefs] = useState<CalendarPrefs>(DEFAULT_CALENDAR_PREFS)
  const [assessments, setAssessments] = useState(() =>
    seedAssessments.map((a) => ({ ...a })),
  )
  const [personalTasks, setPersonalTasks] = useState<CalendarTask[]>(() =>
    seedTasks.map((t) => ({ ...t })),
  )
  const taskSeq = useRef(seedTasks.length)
  const [peerCorrections, setPeerCorrections] = useState<PeerCorrection[]>(() =>
    seedPeerCorrections.map((c) => ({ ...c })),
  )

  const updateTodayPrefs = useCallback(
    (patch: Partial<TodayPrefs>) => setTodayPrefs((p) => ({ ...p, ...patch })),
    [],
  )
  const updateCalendarPrefs = useCallback(
    (patch: Partial<CalendarPrefs>) => setCalendarPrefs((p) => ({ ...p, ...patch })),
    [],
  )

  const addTask = useCallback((task: { title: string; due: string; note?: string }) => {
    taskSeq.current += 1
    const next: CalendarTask = { id: `task-${taskSeq.current}`, done: false, ...task }
    setPersonalTasks((list) => [...list, next])
  }, [])
  const toggleTask = useCallback((id: string) => {
    setPersonalTasks((list) =>
      list.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
    )
  }, [])
  const removeTask = useCallback((id: string) => {
    setPersonalTasks((list) => list.filter((t) => t.id !== id))
  }, [])

  // Shared write surface: Today flips status; Courses edits status/grade/notes.
  const setStatus = useCallback((id: string, status: AssessmentStatus) => {
    setAssessments((list) =>
      list.map((a) => (a.id === id ? { ...a, status } : a)),
    )
  }, [])

  const setGrade = useCallback((id: string, grade: Grade | null) => {
    setAssessments((list) =>
      list.map((a) => (a.id === id ? { ...a, grade } : a)),
    )
  }, [])

  const setNotes = useCallback((id: string, notes: string) => {
    setAssessments((list) =>
      list.map((a) => (a.id === id ? { ...a, notes } : a)),
    )
  }, [])

  const updateAssessment = useCallback(
    (id: string, patch: Partial<Assessment>) => {
      setAssessments((list) =>
        list.map((a) => (a.id === id ? { ...a, ...patch } : a)),
      )
    },
    [],
  )

  const addAssessments = useCallback((items: Assessment[]) => {
    setAssessments((list) => {
      const existing = new Set(list.map((a) => a.id))
      const fresh = items.filter((a) => !existing.has(a.id))
      return fresh.length === 0 ? list : [...list, ...fresh]
    })
  }, [])

  const removeAssessment = useCallback((id: string) => {
    setAssessments((list) => list.filter((a) => a.id !== id))
  }, [])

  const setCourseColor = useCallback((id: string, color: string) => {
    setCourses((list) =>
      list.map((c) => (c.id === id ? { ...c, color } : c)),
    )
  }, [])

  const updateCourse = useCallback((id: string, patch: Partial<Course>) => {
    setCourses((list) =>
      list.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    )
  }, [])

  const courseById = useCallback(
    (id: string): Course | undefined => courses.find((c) => c.id === id),
    [courses],
  )

  // Peer-correction stub: accepting a crowd correction moves the date and marks
  // it confirmed-by-N (the suggestion clears); dismissing just clears it.
  const applyPeerCorrection = useCallback(
    (assessmentId: string) => {
      const c = peerCorrections.find((x) => x.assessmentId === assessmentId)
      if (!c) return
      setAssessments((list) =>
        list.map((a) =>
          a.id === assessmentId
            ? {
                ...a,
                due: c.proposedDue,
                provenance: { status: 'confirmed', confirmations: c.changedCount },
              }
            : a,
        ),
      )
      setPeerCorrections((list) => list.filter((x) => x.assessmentId !== assessmentId))
    },
    [peerCorrections],
  )

  const dismissPeerCorrection = useCallback((assessmentId: string) => {
    setPeerCorrections((list) => list.filter((x) => x.assessmentId !== assessmentId))
  }, [])

  const value = useMemo(
    () => ({
      user: { ...currentUser, plan },
      plan,
      setPlan,
      courses,
      assessments,
      setStatus,
      setGrade,
      setNotes,
      updateAssessment,
      addAssessments,
      removeAssessment,
      setCourseColor,
      updateCourse,
      courseById,
      coursesView,
      setCoursesView,
      todayPrefs,
      updateTodayPrefs,
      personalTasks,
      addTask,
      toggleTask,
      removeTask,
      calendarPrefs,
      updateCalendarPrefs,
      peerCorrections,
      applyPeerCorrection,
      dismissPeerCorrection,
    }),
    [
      plan,
      courses,
      assessments,
      setStatus,
      setGrade,
      setNotes,
      updateAssessment,
      addAssessments,
      removeAssessment,
      setCourseColor,
      updateCourse,
      courseById,
      coursesView,
      todayPrefs,
      updateTodayPrefs,
      personalTasks,
      addTask,
      toggleTask,
      removeTask,
      calendarPrefs,
      updateCalendarPrefs,
      peerCorrections,
      applyPeerCorrection,
      dismissPeerCorrection,
    ],
  )

  return <AppDataContext value={value}>{children}</AppDataContext>
}
