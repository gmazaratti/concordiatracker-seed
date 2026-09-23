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
import { coursePercent, percentToGrade } from '@/lib/gpa'
import { useAuth } from './auth'
import { useSupabaseProfile } from './useSupabaseProfile'
import { supabase, fireWrite } from '@/lib/supabase'
import { usePersisted } from '@/lib/persisted'
import { missingColumn } from '@/lib/pg-errors'
import {
  assessmentFromRow,
  assessmentPatchToRow,
  assessmentToInsert,
  blueprintToInsert,
  courseFromRow,
  courseToRow,
  taskFromRow,
  taskPatchToRow,
  taskToInsert,
  type NewTask,
  type AssignmentRow,
  type CourseRow,
  type TodoRow,
} from '@/lib/supabase-adapters'
import { COURSE_COLORS } from '@/lib/course-color'
import { daysFromNow } from '@/lib/date'
import { SAMPLE_ASSESSMENTS, SAMPLE_COURSE, isSampleId } from '@/features/tour/sample'
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
  const { user, plan, setPlan, applyProUntil, updateProfile, setProgram, updatePrivacy, onboardingCompleted, completeOnboarding, changeHandle } =
    useSupabaseProfile()

  // Phase 3: the loaded rows, tagged with their owner so a different user never
  // briefly sees the previous user's data (the derivation gates on ownerId).
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  // The guided tour merges a throwaway DEMO course + assignments in while it runs
  // (removed when it ends), so the walkthrough never touches the user's real data
  // and works the same on an empty account. Never persisted; writes to sample ids
  // are no-ops (guards below).
  const [sampleOn, setSampleOn] = useState(false)
  const dataReady = !!loaded && loaded.ownerId === authUser?.id
  const baseCourses = dataReady ? loaded!.courses : NO_COURSES
  const baseAssessments = dataReady ? loaded!.assessments : NO_ASSESSMENTS
  // `courses` is the CURRENT term's set — archived (past-term) courses are kept
  // out so Today / the grid / Calendar / GPA all stay about now. The transcript
  // reads `pastCourses`.
  const courses = useMemo(() => {
    const active = baseCourses.filter((c) => !c.archived)
    return sampleOn ? [...active, SAMPLE_COURSE] : active
  }, [sampleOn, baseCourses])
  const pastCourses = useMemo(() => baseCourses.filter((c) => c.archived), [baseCourses])
  const assessments = useMemo(
    () => (sampleOn ? [...baseAssessments, ...SAMPLE_ASSESSMENTS] : baseAssessments),
    [sampleOn, baseAssessments],
  )
  const personalTasks = dataReady ? loaded!.tasks : NO_TASKS
  // Signed in, but the first fetch for this user hasn't landed yet.
  const dataLoading = !!authUser && !dataReady

  const startSample = useCallback(() => setSampleOn(true), [])
  const stopSample = useCallback(() => setSampleOn(false), [])

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

  // These four survive a reload now. "Sticky across SPA nav, resets on reload"
  // was a mock-era choice; with real accounts, a view toggle that forgets on
  // refresh reads as a button that does not work.
  const [coursesView, setCoursesView] = usePersisted<CoursesView>('ct_courses_view', 'grid')
  const [communityView, setCommunityView] = usePersisted<CommunityView>('ct_community_view', 'card')
  const [todayPrefs, setTodayPrefs] = usePersisted<TodayPrefs>('ct_today_prefs', DEFAULT_TODAY_PREFS)
  const [calendarPrefs, setCalendarPrefs] = usePersisted<CalendarPrefs>(
    'ct_calendar_prefs',
    DEFAULT_CALENDAR_PREFS,
  )
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
    [setTodayPrefs],
  )
  const updateCalendarPrefs = useCallback(
    (patch: Partial<CalendarPrefs>) => setCalendarPrefs((p) => ({ ...p, ...patch })),
    [setCalendarPrefs],
  )

  // Personal calendar tasks → the `todos` table (insert DB-generated id, adopt it).
  /**
   * One insert for one task or a whole repeat.
   *
   * `steps` and `repeat_group` are stripped and retried on 42703, the same
   * guard `addAssessments` uses for `description`: a pending migration should
   * cost a checklist, never the ability to add anything to your calendar.
   */
  const addTasks = useCallback(
    async (tasks: NewTask[]) => {
      if (!authUser || tasks.length === 0) return
      const rows = tasks.map((t) => taskToInsert(t, authUser.id))
      const first = await supabase.from('todos').insert(rows).select('*')
      let data = first.data
      if (missingColumn(first.error)) {
        const stripped = rows.map((r) => {
          const copy = { ...r }
          delete copy.steps
          delete copy.repeat_group
          return copy
        })
        data = (await supabase.from('todos').insert(stripped).select('*')).data
      }
      if (data) {
        updateTasks((list) => [...list, ...(data as TodoRow[]).map(taskFromRow)])
      }
    },
    [authUser, updateTasks],
  )
  const addTask = useCallback((task: NewTask) => void addTasks([task]), [addTasks])

  /** Edit in place. Only the keys passed are written, so saving a title cannot
   *  blank a note the form never held. */
  const updateTask = useCallback(
    (id: string, patch: Partial<CalendarTask>) => {
      updateTasks((list) => list.map((t) => (t.id === id ? { ...t, ...patch } : t)))
      fireWrite(supabase.from('todos').update(taskPatchToRow(patch)).eq('id', id))
    },
    [updateTasks],
  )

  /** End a repeat. Only occurrences from now on — deleting the days you already
   *  ticked would erase a record of work done, and "stop reminding me" is not a
   *  request to rewrite the past. */
  const removeTaskSeries = useCallback(
    (group: string) => {
      const from = new Date().toISOString()
      updateTasks((list) =>
        list.filter((t) => t.repeatGroup !== group || (!!t.due && t.due < from)),
      )
      fireWrite(supabase.rpc('delete_todo_series', { p_group: group, p_from: from }))
    },
    [updateTasks],
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
      if (isSampleId(id)) return
      updateAssessments((list) => list.map((a) => (a.id === id ? { ...a, status } : a)))
      queueAssessmentWrite(id, assessmentPatchToRow({ status }))
    },
    [updateAssessments, queueAssessmentWrite],
  )

  const setGrade = useCallback(
    (id: string, grade: Grade | null) => {
      if (isSampleId(id)) return
      updateAssessments((list) => list.map((a) => (a.id === id ? { ...a, grade } : a)))
      queueAssessmentWrite(id, assessmentPatchToRow({ grade }))
    },
    [updateAssessments, queueAssessmentWrite],
  )

  const setNotes = useCallback(
    (id: string, notes: string) => {
      if (isSampleId(id)) return
      updateAssessments((list) => list.map((a) => (a.id === id ? { ...a, notes } : a)))
      queueAssessmentWrite(id, { notes })
    },
    [updateAssessments, queueAssessmentWrite],
  )

  const updateAssessment = useCallback(
    (id: string, patch: Partial<Assessment>) => {
      if (isSampleId(id)) return
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
      const first = await supabase.from('assignments').insert(rows).select('*')
      let data = first.data
      // The `description` column may not be migrated yet → retry without it.
      if (missingColumn(first.error)) {
        const stripped = rows.map((r) => {
          const copy = { ...r }
          delete copy.description
          return copy
        })
        data = (await supabase.from('assignments').insert(stripped).select('*')).data
      }
      if (data) updateAssessments((list) => [...list, ...(data as AssignmentRow[]).map(assessmentFromRow)])
    },
    [authUser, updateAssessments],
  )

  const removeAssessment = useCallback(
    (id: string) => {
      if (isSampleId(id)) return
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
      if (isSampleId(id)) return
      updateCourses((list) => list.map((c) => (c.id === id ? { ...c, color } : c)))
      fireWrite(supabase.from('courses').update({ color }).eq('id', id))
    },
    [updateCourses],
  )

  const updateCourse = useCallback(
    (id: string, patch: Partial<Course>) => {
      if (isSampleId(id)) return
      updateCourses((list) => list.map((c) => (c.id === id ? { ...c, ...patch } : c)))
      fireWrite(supabase.from('courses').update(courseToRow(patch)).eq('id', id))
    },
    [updateCourses],
  )

  // Course creation — insert a course (DB-generated id), adopt it. Blank for a
  // manual add; pre-filled code/title/section when added from a blueprint.
  const createCourse = useCallback(
    async (init?: {
      code?: string
      title?: string
      section?: string
      credits?: number
      /** A later term, for classes you are registered in but not yet taking.
       *  Defaults to the term you are running. */
      term?: string
      /** Omitted means registered — see the note on Course.enrollment. */
      enrollment?: Course['enrollment']
      /**
       * HOW it was added, recorded rather than inferred. `origin: 'manual'`
       * is stamped on every path, so it cannot tell a catalogue pick from a
       * typed code — which is exactly the wrong answer the admin panel was
       * about to show. Every caller passes this; an omitted one stays null
       * and reads as "not recorded" rather than as a guess.
       */
      source?: 'catalogue' | 'manual' | 'blueprint' | 'outline' | 'moodle' | 'syllabus'
    }) => {
      if (!authUser) return ''
      const color = COURSE_COLORS[colorSeq.current % COURSE_COLORS.length].id
      colorSeq.current += 1
      let { data } = await supabase
        .from('courses')
        .insert({
          user_id: authUser.id,
          code: init?.code ?? '',
          name: init?.title ?? '',
          term: init?.term ?? term.name,
          // Was below the spread that set it, so an explicit credit count was
          // always overwritten with 3.
          credits: init?.credits ?? 3,
          color,
          section: init?.section ?? '',
          professor: '',
          prof_email: '',
          location: '',
          time: '',
          syllabus_url: '',
          origin: 'manual',
          enrollment: init?.enrollment ?? null,
          source: init?.source ?? null,
        })
        .select('*')
        .maybeSingle()
      // The source column may not be migrated yet; the course matters more
      // than knowing where it came from, so retry without it.
      if (!data && init?.source) {
        const retry = await supabase
          .from('courses')
          .insert({
            user_id: authUser.id,
            code: init?.code ?? '',
            name: init?.title ?? '',
            term: init?.term ?? term.name,
            credits: init?.credits ?? 3,
            color,
            section: init?.section ?? '',
            professor: '',
            prof_email: '',
            location: '',
            time: '',
            syllabus_url: '',
            origin: 'manual',
            enrollment: init?.enrollment ?? null,
          })
          .select('*')
          .maybeSingle()
        if (retry.data) data = retry.data
      }
      if (!data) return ''
      const course = courseFromRow(data as CourseRow)
      updateCourses((list) => [...list, course])
      return course.id
    },
    [authUser, updateCourses],
  )

  // ── Academic history ──────────────────────────────────────────────────────
  // Archive a finished course: FREEZE its computed grade onto the row, then move
  // it to the transcript. Snapshotting is the point — a past term's GPA must not
  // drift if an old assessment is edited later.
  const archiveCourse = useCallback(
    (id: string) => {
      if (isSampleId(id)) return
      const course = baseCourses.find((c) => c.id === id)
      if (!course) return
      const percent = coursePercent(baseAssessments.filter((a) => a.courseId === id))
      const patch: Partial<Course> = {
        archived: true,
        ...(percent !== null
          ? { finalPercent: percent, finalLetter: percentToGrade(percent).letter }
          : {}),
      }
      updateCourses((list) => list.map((c) => (c.id === id ? { ...c, ...patch } : c)))
      fireWrite(supabase.from('courses').update(courseToRow(patch)).eq('id', id))
    },
    [baseCourses, baseAssessments, updateCourses],
  )

  /** Undo an archive — the course returns to the current term (grade unfrozen). */
  const unarchiveCourse = useCallback(
    (id: string) => {
      if (isSampleId(id)) return
      const patch: Partial<Course> = { archived: false, finalPercent: undefined, finalLetter: undefined }
      updateCourses((list) => list.map((c) => (c.id === id ? { ...c, ...patch } : c)))
      fireWrite(supabase.from('courses').update(courseToRow(patch)).eq('id', id))
    },
    [updateCourses],
  )

  /** Add a course from BEFORE you used the app — transcript-style: no
   * assessments, just the final grade you already earned.
   *
   * The grade is OPTIONAL. Someone rebuilding three years of history should not
   * have to look up every mark to get their credit count and their unlocked
   * courses; an ungraded row still counts for both and is simply skipped by the
   * GPA math (currentGpa ignores a null percent). */
  const addPastCourse = useCallback(
    async (init: {
      code: string
      title: string
      term: string
      credits: number
      finalPercent?: number
      /** Overrides the letter derived from the percentage. Needed for notations
       *  like FNS, which are worth 0.00 but are not the letter F, and would
       *  otherwise come back out of storage as something the student did not
       *  enter. */
      finalLetter?: string
      /** False for a term that has not happened yet: those are classes you are
       *  about to take, and filing them as history would put them on the
       *  transcript ungraded and hide them from the term you are running. */
      archived?: boolean
    }) => {
      if (!authUser) return ''
      const color = COURSE_COLORS[colorSeq.current % COURSE_COLORS.length].id
      colorSeq.current += 1
      const { data } = await supabase
        .from('courses')
        .insert({
          user_id: authUser.id,
          code: init.code,
          name: init.title,
          term: init.term,
          credits: init.credits,
          color,
          section: '',
          professor: '',
          prof_email: '',
          location: '',
          time: '',
          syllabus_url: '',
          origin: 'manual',
          archived: init.archived ?? true,
          final_percent: init.finalPercent ?? null,
          final_letter:
            init.finalLetter ??
            (init.finalPercent === undefined ? null : percentToGrade(init.finalPercent).letter),
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
      if (isSampleId(id)) return
      updateCourses((list) => list.filter((c) => c.id !== id))
      updateAssessments((list) => list.filter((a) => a.courseId !== id))
      await supabase.from('assignments').delete().eq('course_id', id)
      fireWrite(supabase.from('courses').delete().eq('id', id))
    },
    [updateCourses, updateAssessments],
  )

  // OPT-IN share: publish this course's current outline to the shared blueprint
  // pool (the only path that writes there — courses are private by default).
  //
  // THIS THROWS ON FAILURE, and that is the whole point of the rewrite. It used
  // to fire the insert and ignore the result, so a share rejected by RLS still
  // showed the student "Thanks for sharing". Measured against production: an
  // account with no `user_profile` row gets a 403 from the insert policy, and
  // the old code reported that as a success. Nobody could report the bug,
  // because nobody was ever told there was one.
  const shareCourseAsBlueprint = useCallback(
    async (courseId: string) => {
      if (!authUser) throw new Error('Sign in again to share an outline.')
      const course = courses.find((c) => c.id === courseId)
      if (!course) throw new Error('That course is no longer here.')
      const items = assessments.filter((a) => a.courseId === courseId)
      if (items.length === 0) throw new Error('Add at least one assessment before sharing.')
      const { data, error } = await supabase
        .from('shared_blueprints')
        .insert(blueprintToInsert({ userId: authUser.id, course, author: user.name, assessments: items }))
        .select('id')
        .maybeSingle()
      if (error) {
        // 42501 is the row-level-security rejection. It is not the student's
        // fault and not something they can fix, so say what it is rather than
        // printing a Postgres code at them.
        throw new Error(
          error.code === '42501'
            ? 'We could not publish that outline — your account is not allowed to share right now. Tell us and we will sort it out.'
            : error.message || 'Sharing failed. Try again in a moment.',
        )
      }
      if (!data) throw new Error('Sharing failed — nothing was saved. Try again.')
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
      applyProUntil,
      updateProfile,
      setProgram,
      updatePrivacy,
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
      pastCourses,
      archiveCourse,
      unarchiveCourse,
      addPastCourse,
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
      addTasks,
      updateTask,
      removeTaskSeries,
      toggleTask,
      removeTask,
      isReminderSet: (eventId: string) => reminderIds.has(eventId),
      toggleReminder,
      calendarPrefs,
      updateCalendarPrefs,
      peerCorrections,
      applyPeerCorrection,
      dismissPeerCorrection,
      startSample,
      stopSample,
    }),
    [
      user,
      plan,
      setPlan,
      applyProUntil,
      updateProfile,
      setProgram,
      updatePrivacy,
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
      pastCourses,
      archiveCourse,
      unarchiveCourse,
      addPastCourse,
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
      addTasks,
      updateTask,
      removeTaskSeries,
      toggleTask,
      removeTask,
      reminderIds,
      toggleReminder,
      calendarPrefs,
      updateCalendarPrefs,
      peerCorrections,
      applyPeerCorrection,
      dismissPeerCorrection,
      startSample,
      stopSample,
    ],
  )

  return <AppDataContext value={value}>{children}</AppDataContext>
}
