import { useCallback, useEffect, useMemo, useState } from 'react'
import { Bookmark, BookOpen, Check, Loader2, Search } from 'lucide-react'
import { useI18n } from '@/i18n/i18n'
import { useAppData } from '@/app/providers/app-data'
import { loadAcademicProfile, summarizeRecord } from '@/lib/academic-record'
import { normalizeCode } from '@/lib/prereq'
import { CourseSkeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/cn'
import { listSaved, saveCourse, unsaveCourse } from '@/lib/saved-courses'
import { PrereqChips } from './PrereqChips'
import { CourseSections } from './CourseSections'
import { formatMonthDay } from '@/lib/date'
import {
  browseCourses,
  catalogStatus,
  extractCourseCodes,
  mySubjects,
  searchCourses,
  type CatalogCourse,
} from '@/lib/catalog'

const PAGE = 10

/**
 * Search every course Concordia publishes.
 *
 * Reads the Supabase mirror, not Concordia, so typing does not cost them a
 * request per keystroke. The mirror's age is shown rather than implied: this is
 * catalogue data that changes yearly, and saying when it was synced is more
 * honest than presenting it as live.
 */
export function CourseDirectory() {
  const { t } = useI18n()
  const { pastCourses, courses, assessments } = useAppData()
  const [trusted, setTrusted] = useState(false)
  const [savedCodes, setSavedCodes] = useState<Set<string>>(new Set())

  useEffect(() => {
    let alive = true
    void loadAcademicProfile().then((p) => {
      if (alive) setTrusted(p.recordComplete)
    })
    void listSaved().then((rows) => {
      if (alive) setSavedCodes(new Set(rows.map((r) => r.code)))
    })
    return () => {
      alive = false
    }
  }, [])

  // Courses in progress count toward a prerequisite that allows concurrency,
  // and toward one you will have met by the time the next term starts.
  const record = useMemo(() => {
    const summary = summarizeRecord(pastCourses, assessments)
    const codes = new Set(summary.completedCodes.map(normalizeCode))
    for (const c of courses) if (c.code.trim()) codes.add(normalizeCode(c.code))
    return { completed: codes, credits: summary.credits }
  }, [pastCourses, courses, assessments])
  const [q, setQ] = useState('')
  const [results, setResults] = useState<CatalogCourse[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<{ total: number; synced_at: string | null } | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  // The default list, shown before anyone types. An empty box makes a working
  // feature look broken and gives a student nothing to react to.
  const [browsed, setBrowsed] = useState<CatalogCourse[]>([])
  const [total, setTotal] = useState(0)
  const [subjects, setSubjects] = useState<string[]>([])
  const [loadingMore, setLoadingMore] = useState(false)
  // The very first page, which is a network round trip before anything at all
  // is on screen. Distinct from `loadingMore`, which has rows above it already.
  const [loadingFirst, setLoadingFirst] = useState(true)

  useEffect(() => {
    let alive = true
    void (async () => {
      // Someone in Computer Science should be shown COMP courses without
      // having to ask for them; with no history, the whole calendar.
      const [s, subs] = await Promise.all([
        catalogStatus().catch(() => null),
        mySubjects().catch(() => []),
      ])
      if (!alive) return
      setStatus(s)
      setSubjects(subs)
      const page = await browseCourses({ subjects: subs.slice(0, 4), limit: PAGE }).catch(() => ({
        rows: [],
        total: 0,
      }))
      if (!alive) return
      setBrowsed(page.rows)
      setTotal(page.total)
      setLoadingFirst(false)
    })()
    return () => {
      alive = false
    }
  }, [])

  const toggleSave = useCallback(async (course: CatalogCourse) => {
    const code = `${course.subject} ${course.catalog}`
    // Optimistic: saving is reversible and instant feedback matters more here
    // than surviving a failed write, which the next load corrects anyway.
    setSavedCodes((prev) => {
      const next = new Set(prev)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      return next
    })
    if (savedCodes.has(code)) await unsaveCourse(code)
    else await saveCourse(code, course.title)
  }, [savedCodes])

  async function loadMore() {
    setLoadingMore(true)
    const page = await browseCourses({
      subjects: subjects.slice(0, 4),
      offset: browsed.length,
      limit: PAGE,
    })
    setBrowsed((prev) => [...prev, ...page.rows])
    setTotal(page.total)
    setLoadingMore(false)
  }

  // Debounced so a fast typist fires one query rather than eight.
  useEffect(() => {
    const term = q.trim()
    let alive = true
    const id = window.setTimeout(
      () => {
        if (!term) {
          if (alive) setResults(null)
          return
        }
        if (alive) setBusy(true)
        void searchCourses(term)
          .then((rows) => {
            if (!alive) return
            setResults(rows)
            setBusy(false)
          })
          .catch(() => {
            if (!alive) return
            setResults([])
            setBusy(false)
          })
      },
      term ? 220 : 0,
    )
    return () => {
      alive = false
      window.clearTimeout(id)
    }
  }, [q])

  return (
    <div>
      <div className="relative">
        <Search
          size={16}
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-subtle"
        />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('planner.dir.placeholder')}
          aria-label={t('planner.dir.label')}
          className="w-full rounded-xl border border-border bg-surface py-3 pr-10 pl-10 text-[14px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none"
        />
        {busy && (
          <Loader2
            size={15}
            className="absolute top-1/2 right-3.5 -translate-y-1/2 animate-spin text-accent"
            aria-hidden
          />
        )}
      </div>

      {status && (
        <p className="mt-2 text-[11.5px] text-subtle">
          {status.total === 0
            ? t('planner.dir.notSynced')
            : t('planner.dir.synced', {
                total: status.total.toLocaleString(),
                date: status.synced_at
                  ? formatMonthDay(new Date(status.synced_at))
                  : t('planner.dir.never'),
              })}
        </p>
      )}

      <div className="mt-4">
        {loadingFirst ? (
          <CourseSkeleton />
        ) : results === null ? (
          browsed.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border px-6 py-14 text-center">
              <BookOpen size={22} className="mx-auto text-subtle" aria-hidden />
              <p className="mt-2 text-[13px] text-subtle">{t('planner.dir.hint')}</p>
            </div>
          ) : (
            <>
              <p className="mb-2 text-[11.5px] text-subtle">
                {subjects.length > 0
                  ? t('planner.dir.fromYourSubjects', { subjects: subjects.slice(0, 4).join(', ') })
                  : t('planner.dir.browsing')}
              </p>
              <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
                {browsed.map((c) => (
                  <CourseRow
                    key={c.id}
                    course={c}
                    expanded={open === c.id}
                    onToggle={() => setOpen(open === c.id ? null : c.id)}
                    onFollowCode={setQ}
                    record={record}
                    trusted={trusted}
                    saved={savedCodes}
                    onToggleSave={toggleSave}
                  />
                ))}
              </ul>
              {browsed.length < total && (
                <button
                  type="button"
                  onClick={() => void loadMore()}
                  disabled={loadingMore}
                  className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-border py-2 text-[13px] font-medium text-muted transition-colors duration-150 hover:border-accent hover:text-fg disabled:opacity-60"
                >
                  {loadingMore && <Loader2 size={13} className="animate-spin" aria-hidden />}
                  {t('planner.dir.loadMore', { shown: browsed.length, total })}
                </button>
              )}
            </>
          )
        ) : results.length === 0 ? (
          <p className="px-4 py-10 text-center text-[13px] text-subtle">
            {t('planner.dir.noMatch')}
          </p>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
            {results.map((c) => (
              <CourseRow
                key={c.id}
                course={c}
                expanded={open === c.id}
                onToggle={() => setOpen(open === c.id ? null : c.id)}
                onFollowCode={setQ}
                record={record}
                trusted={trusted}
                saved={savedCodes}
                onToggleSave={toggleSave}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function CourseRow({
  course,
  expanded,
  onToggle,
  onFollowCode,
  record,
  trusted,
  saved,
  onToggleSave,
}: {
  course: CatalogCourse
  expanded: boolean
  onToggle: () => void
  onFollowCode: (code: string) => void
  record: { completed: Set<string>; credits: number }
  trusted: boolean
  saved: Set<string>
  onToggleSave: (course: CatalogCourse) => void
}) {
  const { t } = useI18n()
  const linked = extractCourseCodes(course.prerequisites)

  const meta = [
    course.class_unit
      ? t('planner.dir.credits', { n: course.class_unit })
      : t('planner.dir.noCredits'),
    course.career ? (course.career === 'UGRD' ? t('planner.dir.undergrad') : course.career) : null,
    linked.length === 0
      ? null
      : linked.length === 1
        ? t('planner.dir.prereqCountOne')
        : t('planner.dir.prereqCount', { n: linked.length }),
  ].filter(Boolean)

  return (
    <li className="relative">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-center gap-3 py-3 pr-24 pl-4 text-left transition-colors duration-150 hover:bg-surface-2"
      >
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="shrink-0 rounded bg-accent-soft px-1.5 py-0.5 text-[11px] font-semibold text-accent">
              {course.subject} {course.catalog}
            </span>
            <span className="truncate text-[13.5px] font-medium text-fg">{course.title}</span>
          </span>
          <span className="mt-0.5 block text-[11.5px] text-subtle">{meta.join(' · ')}</span>
        </span>
      </button>

      {/* A sibling of the expand button, not a child of it: a button inside a
          button is invalid, and clicking Save should not also toggle the row. */}
      <button
        type="button"
        onClick={() => onToggleSave(course)}
        aria-pressed={saved.has(`${course.subject} ${course.catalog}`)}
        aria-label={`${saved.has(`${course.subject} ${course.catalog}`) ? 'Remove' : 'Save'} ${course.subject} ${course.catalog}`}
        className={cn(
          'absolute top-2.5 right-3 inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors duration-150',
          saved.has(`${course.subject} ${course.catalog}`)
            ? 'border-accent bg-accent-soft text-accent'
            : 'border-border text-subtle hover:border-accent hover:text-fg',
        )}
      >
        {saved.has(`${course.subject} ${course.catalog}`) ? (
          <Check size={11} aria-hidden />
        ) : (
          <Bookmark size={11} aria-hidden />
        )}
        {saved.has(`${course.subject} ${course.catalog}`) ? 'Saved' : 'Save'}
      </button>

      {expanded && (
        <div className="space-y-3 border-t border-border/60 bg-canvas/40 px-4 py-3">
          {course.description ? (
            <p className="text-[12.5px] leading-relaxed text-muted">{course.description}</p>
          ) : (
            <p className="text-[12px] text-subtle italic">
              No description in the mirror for this course yet.
            </p>
          )}

          {course.prerequisites ? (
            <PrereqChips
              prerequisites={course.prerequisites}
              completed={record.completed}
              credits={record.credits}
              trusted={trusted}
            />
          ) : (
            <p className="text-[12.5px] text-subtle">No prerequisites listed.</p>
          )}

          {linked.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold tracking-wide text-subtle uppercase">
                Look up
              </p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {linked.map((code) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => onFollowCode(code)}
                    className="rounded border border-border px-1.5 py-0.5 text-[11px] font-medium text-muted transition-colors duration-150 hover:border-accent hover:text-accent"
                  >
                    {code}
                  </button>
                ))}
              </div>
            </div>
          )}

          <CourseSections subject={course.subject} catalog={course.catalog} />
        </div>
      )}
    </li>
  )
}
