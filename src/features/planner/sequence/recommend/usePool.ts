import { useEffect, useMemo, useState } from 'react'
import { browseCourses, coursesByCodes, type CatalogCourse } from '@/lib/catalog'
import { planKey, type PlanCourse } from '@/lib/course-plan'
import { parsePrereq, type Prereq } from '@/lib/prereq'
import { recommend } from '@/lib/recommend'
import { useProgramForUser } from '../../useProgramForUser'
import { interestLabel } from './subjects'

export type PoolReason = 'required' | 'elective' | 'interest'
export interface PoolItem extends PlanCourse {
  reason: PoolReason
  because: string
  subject: string
}
export interface PlanPrefs {
  like: string[]
  avoid: string[]
  /** Most credits to put in one term. */
  max: number
}
export const DEFAULT_PREFS: PlanPrefs = { like: [], avoid: [], max: 15 }

/** Per liked subject: enough to choose from, not the whole department. */
const PER_INTEREST = 8

/**
 * Everything worth suggesting, in order: what the programme requires, what
 * fills one of its elective rules, then courses from the areas the student
 * said they are into. Areas they said no to are left out, except where the
 * programme requires the course: a requirement is not a matter of taste.
 */
export function usePool(taken: string[], prefs: PlanPrefs) {
  const program = useProgramForUser()
  const [rows, setRows] = useState<CatalogCourse[] | null>(null)
  const [extra, setExtra] = useState<CatalogCourse[]>([])
  const likeKey = prefs.like.join(',')

  useEffect(() => {
    let alive = true
    const subjects = program
      ? [...new Set(program.groups.flatMap((g) => [...(g.pattern ? [g.pattern.subject] : []), ...g.courses.map((c) => c.code.split(/[\s-]/)[0])]))]
      : []
    const liked = likeKey ? likeKey.split(',') : []
    void Promise.all([
      subjects.length ? browseCourses({ subjects, limit: 400 }) : Promise.resolve({ rows: [] as CatalogCourse[] }),
      // One subject at a time so a big department cannot crowd out a small one.
      Promise.all(liked.map((s) => browseCourses({ subjects: [s], limit: 60 }))),
    ]).then(([main, likes]) => {
      if (!alive) return
      const seen = new Set<string>()
      setRows([...main.rows, ...likes.flatMap((l) => l.rows)].filter((r) => !seen.has(r.id) && seen.add(r.id)))
    })
    return () => {
      alive = false
    }
  }, [program, likeKey])

  const pool = useMemo<PoolItem[] | null>(() => {
    if (!rows) return null
    const done = new Set(taken.map(planKey))
    const avoid = new Set(prefs.avoid)
    const like = new Set(prefs.like)
    const out: PoolItem[] = []
    const seen = new Set<string>()
    const push = (item: PoolItem) => {
      const k = planKey(item.code)
      if (done.has(k) || seen.has(k)) return
      seen.add(k)
      out.push(item)
    }
    const subjectOf = (code: string) => code.split(/[\s-]/)[0].toUpperCase()

    const suggested = program
      ? recommend(
          { program, taken, catalog: rows.map((r) => ({ subject: r.subject, catalog: r.catalog, title: r.title, credits: r.class_unit ?? 3, prerequisites: r.prerequisites })) },
          300,
        )
      : []
    for (const s of suggested.filter((x) => x.reason === 'required')) {
      push({ code: s.code, title: s.title, credits: s.credits, reason: 'required', because: s.because, subject: subjectOf(s.code) })
    }
    const electives = suggested.filter((x) => x.reason === 'elective' && !avoid.has(subjectOf(x.code)))
    // Liked areas lead, otherwise the calendar's own order.
    for (const s of [...electives.filter((x) => like.has(subjectOf(x.code))), ...electives.filter((x) => !like.has(subjectOf(x.code)))]) {
      push({ code: s.code, title: s.title, credits: s.credits, reason: 'elective', because: s.because, subject: subjectOf(s.code) })
    }
    for (const subject of prefs.like) {
      const mine = rows
        .filter((r) => r.subject === subject && (r.career ?? 'UGRD').toUpperCase().startsWith('U') && /^[2-4]\d\d/.test(r.catalog))
        .sort((a, b) => a.catalog.localeCompare(b.catalog))
        .slice(0, PER_INTEREST)
      for (const r of mine) {
        push({
          code: `${r.subject} ${r.catalog}`,
          title: r.title,
          credits: r.class_unit ?? 3,
          reason: 'interest',
          because: `You said you are into ${interestLabel(subject).toLowerCase()}. Check that it counts toward your degree.`,
          subject,
        })
      }
    }
    return out
  }, [rows, program, taken, prefs.avoid, prefs.like])

  // Prerequisites for exactly the pooled courses: the browse is capped, and a
  // course missing from it would be placed as if it needed nothing.
  const codes = useMemo(() => (pool ?? []).map((p) => p.code).join('|'), [pool])
  useEffect(() => {
    if (!codes) return
    let alive = true
    void coursesByCodes(codes.split('|')).then((r) => alive && setExtra(r))
    return () => {
      alive = false
    }
  }, [codes])

  const prereqs = useMemo(
    () => new Map<string, Prereq>([...(rows ?? []), ...extra].map((r) => [planKey(`${r.subject}${r.catalog}`), parsePrereq(r.prerequisites, `${r.subject} ${r.catalog}`)])),
    [rows, extra],
  )

  return { program, pool, prereqs }
}
