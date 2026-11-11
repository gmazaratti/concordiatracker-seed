import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAppData } from '@/app/providers/app-data'
import { useUiState } from '@/app/providers/ui-state'
import { useAuth } from '@/app/providers/auth'
import { supabase } from '@/lib/supabase'
import { coursePercent, currentGpa } from '@/lib/gpa'
import { cardFor, popupFor, type DiscoverySignals, type DiscoveryState, type FeatureUsage, type Nudge } from '@/lib/discovery'

/** One read per account per session: usage only changes when they use something. */
const usageCache = new Map<string, FeatureUsage>()

function useFeatureUsage(): FeatureUsage | null {
  const { user } = useAuth()
  const uid = user?.id ?? null
  const [usage, setUsage] = useState<FeatureUsage | null>(uid ? (usageCache.get(uid) ?? null) : null)
  useEffect(() => {
    if (!uid || usageCache.has(uid)) return
    let alive = true
    void supabase.rpc('my_feature_usage').then(({ data, error }) => {
      if (!alive || error || !data) return
      usageCache.set(uid, data as FeatureUsage)
      setUsage(data as FeatureUsage)
    })
    return () => {
      alive = false
    }
  }, [uid])
  return usage
}

const SNOOZE_MS = 3 * 86_400_000
const UNMEASURED = new Set(['grade-needed', 'what-if'])

/**
 * The discovery engine wired to this student: their signals, the nudge for the
 * Today card, the popup if one is due, and the four things a nudge can have
 * done to it. State lives in ui_state, so it follows the account across devices.
 */
export function useDiscovery() {
  const { courses, pastCourses, assessments, personalTasks, plan, user, dataLoading } = useAppData()
  const { uiState, loaded, patchUiState } = useUiState()
  const usage = useFeatureUsage()
  const [now] = useState(() => Date.now())
  const [desktop] = useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches)

  const signals = useMemo<DiscoverySignals>(() => {
    const byCourse = new Map<string, typeof assessments>()
    for (const a of assessments) {
      const list = byCourse.get(a.courseId)
      if (list) list.push(a)
      else byCourse.set(a.courseId, [a])
    }
    let weakest: DiscoverySignals['weakest'] = null
    let emptyCourse: DiscoverySignals['emptyCourse'] = null
    let ungradedCourse: DiscoverySignals['ungradedCourse'] = null
    for (const c of courses) {
      const list = byCourse.get(c.id) ?? []
      if (list.length === 0 && c.code && !emptyCourse) emptyCourse = { id: c.id, code: c.code }
      const pct = coursePercent(list)
      if (pct !== null && (!weakest || pct < weakest.percent)) weakest = { id: c.id, code: c.code, percent: pct }
      const waiting = list.some(
        (a) => !a.grade && (a.status === 'done' || a.status === 'late' || (a.due !== null && new Date(a.due).getTime() < now)),
      )
      if (waiting && !ungradedCourse) ungradedCourse = { id: c.id, code: c.code }
    }
    const live = new Set(courses.map((c) => c.id))
    return {
      usage,
      currentCourses: courses.length,
      emptyCourse,
      pastCourses: pastCourses.length,
      gradedCount: assessments.filter((a) => a.grade && live.has(a.courseId)).length,
      ungradedCourse,
      gpa: currentGpa([...pastCourses, ...courses], assessments),
      weakest,
      upcomingDated: assessments.filter((a) => a.due !== null && new Date(a.due).getTime() > now && live.has(a.courseId)).length,
      hasReminders: !!uiState.assignmentReminders?.enabled,
      personalTasks: personalTasks.filter((t) => !t.source).length,
      pro: plan !== 'free',
      atConcordia: user.atConcordia,
      desktop,
      month: new Date(now).getMonth(),
      goals: uiState.goals,
    }
  }, [courses, pastCourses, assessments, personalTasks, plan, user.atConcordia, usage, uiState.assignmentReminders, uiState.goals, now, desktop])

  const ready = loaded && !dataLoading
  const state = useMemo<DiscoveryState>(() => uiState.discovery ?? {}, [uiState.discovery])
  const visitDays = uiState.visitDays?.length ?? 1

  const popup: Nudge | null = ready && usage ? popupFor(signals, state, visitDays, now) : null
  // One surface at a time: while a popup is due (or showed today) the card rests.
  const card: Nudge | null = ready && !popup ? cardFor(signals, state, now) : null

  const write = useCallback(
    (patch: (s: DiscoveryState) => DiscoveryState) => patchUiState({ discovery: patch(uiState.discovery ?? {}) }),
    [patchUiState, uiState.discovery],
  )
  /** They followed the nudge. For features we cannot measure, that is "used". */
  const tried = useCallback((id: string) => write((s) => ({ ...s, tried: [...new Set([...(s.tried ?? []), id])] })), [write])
  /** "Not now": the card comes back in three days. */
  const snooze = useCallback(
    (id: string) => write((s) => ({ ...s, snoozed: { ...(s.snoozed ?? {}), [id]: new Date(Date.now() + SNOOZE_MS).toISOString() } })),
    [write],
  )
  /** "Don't show this again." */
  const dismiss = useCallback((id: string) => write((s) => ({ ...s, dismissed: [...new Set([...(s.dismissed ?? []), id])] })), [write])
  const markPopped = useCallback(
    (id: string) => {
      const at = new Date().toISOString()
      write((s) => ({ ...s, popped: { ...(s.popped ?? {}), [id]: at }, lastPop: at }))
    },
    [write],
  )

  /**
   * They pressed the button. Only the two features we cannot measure are
   * retired by that; anything measurable just steps back for a few days and
   * returns if they still have not used it (opening Moodle settings is not
   * connecting Moodle).
   */
  const follow = useCallback((id: string) => (UNMEASURED.has(id) ? tried(id) : snooze(id)), [tried, snooze])

  return { card, popup, follow, snooze, dismiss, markPopped }
}
