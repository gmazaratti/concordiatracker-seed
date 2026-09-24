import { useEffect, useState } from 'react'
import { BookOpen, Check, Loader2, Plus } from 'lucide-react'
import { useAppData } from '@/app/providers/app-data'
import { searchCourses, type CatalogCourse } from '@/lib/catalog'
import { coursesFromMoodle, type MoodleCourseHint } from '@/lib/moodle-match'
import { termLabel } from '@/lib/course-sections'
import { normalizeCode } from '@/lib/prereq'
import { cn } from '@/lib/cn'
import type { CalendarTask } from '@/data/types'

/**
 * The classes Moodle already told us about.
 *
 * Every event carries its course in CATEGORIES as `FINA-210-2262-B`, so the
 * feed names the subject, the catalogue number, the TERM and the SECTION for
 * every class the student is in. Asking them to type all that again, having
 * just been handed it, would be silly.
 *
 * TWO LIMITS, BOTH STATED ON SCREEN rather than discovered later:
 *
 *   1. Only courses with EVENTS appear. A professor who has posted nothing is
 *      invisible to the calendar, so this is "classes Moodle has posted
 *      something for", not "your classes" — and calling it the latter would
 *      be a confident claim we cannot support.
 *   2. Nothing is added without being asked. Ticking a box is one action; a
 *      term silently filling with courses you then have to delete is worse
 *      than typing three codes.
 *
 * The title and the credit count come from Concordia's own catalogue, not from
 * Moodle — Moodle's short name is an abbreviation, and a wrong credit count
 * quietly breaks the full-time check, the cost estimate and the degree audit
 * at once.
 */
export function MoodleCourses({ tasks }: { tasks: CalendarTask[] }) {
  const { courses, createCourse, updateCourse } = useAppData()
  const [hints, setHints] = useState<MoodleCourseHint[]>([])
  const [catalog, setCatalog] = useState<Record<string, CatalogCourse>>({})
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [added, setAdded] = useState(0)
  const [loading, setLoading] = useState(true)

  // What the feed names, minus what is already here.
  const have = new Set(courses.map((c) => normalizeCode(c.code)))
  const missing = hints.filter((h) => !have.has(normalizeCode(h.code)))

  useEffect(() => {
    let alive = true
    const found = coursesFromMoodle(
      tasks.map((t) => ({ id: t.id, title: t.title, due: t.due, note: t.note, source: t.source })),
    )
    void (async () => {
      // One lookup per code. A handful of courses, so a loop is honest and a
      // failure on one must not cost the others their titles.
      const map: Record<string, CatalogCourse> = {}
      await Promise.all(
        found.map(async (h) => {
          try {
            const rows = await searchCourses(h.code, 5)
            const exact = rows.find((r) => normalizeCode(`${r.subject} ${r.catalog}`) === normalizeCode(h.code))
            if (exact) map[h.code] = exact
          } catch {
            /* no title from the catalogue — the code alone is still useful */
          }
        }),
      )
      if (!alive) return
      setHints(found)
      setCatalog(map)
      setPicked(new Set(found.map((h) => h.code)))
      setLoading(false)
    })()
    return () => {
      alive = false
    }
  }, [tasks])

  async function add() {
    setBusy(true)
    let n = 0
    for (const h of missing) {
      if (!picked.has(h.code)) continue
      const cat = catalog[h.code]
      const id = await createCourse({ source: 'moodle',
        term: h.termCode ? termLabel(h.termCode) : undefined,
      })
      if (!id) continue
      updateCourse(id, {
        code: cat ? `${cat.subject} ${cat.catalog}` : h.code,
        title: cat?.title ?? '',
        // Concordia's own number, never an assumed 3 — COMP 248 is 3.5, and a
        // wrong one breaks the full-time check and the degree audit silently.
        ...(cat?.class_unit ? { credits: Number(cat.class_unit) } : {}),
        ...(h.section ? { section: h.section } : {}),
      })
      n++
    }
    setAdded(n)
    setBusy(false)
  }

  if (loading || missing.length === 0) return null

  return (
    <div className="rounded-lg border border-accent/40 bg-accent-soft/30 p-3">
      <p className="flex items-center gap-1.5 text-[12.5px] font-medium text-fg">
        <BookOpen size={14} className="shrink-0 text-accent" aria-hidden />
        {added > 0
          ? `Added ${added} ${added === 1 ? 'course' : 'courses'}`
          : `Moodle also knows about ${missing.length} ${missing.length === 1 ? 'class' : 'classes'} you have not added`}
      </p>

      {added > 0 ? (
        <p className="mt-1 text-[11.5px] leading-relaxed text-subtle">
          They are on your Courses page. Add a syllabus to each one to get weights and grades.
          Moodle only carries dates.
        </p>
      ) : (
        <>
          <ul className="mt-2 space-y-1">
            {missing.map((h) => {
              const cat = catalog[h.code]
              const on = picked.has(h.code)
              return (
                <li key={h.code}>
                  <label className="flex cursor-pointer items-start gap-2 rounded-md px-1 py-1 hover:bg-surface-2/50">
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={(e) => {
                        const next = new Set(picked)
                        if (e.target.checked) next.add(h.code)
                        else next.delete(h.code)
                        setPicked(next)
                      }}
                      className="mt-0.5 size-3.5 shrink-0 accent-[var(--ct-accent)]"
                    />
                    <span className="min-w-0">
                      <span className="block text-[12.5px] text-fg">
                        {cat ? `${cat.subject} ${cat.catalog}` : h.code}
                        {cat?.title ? <span className="text-subtle"> · {cat.title}</span> : null}
                      </span>
                      <span className="block text-[11px] text-subtle">
                        {[
                          h.termCode ? termLabel(h.termCode) : null,
                          h.section ? `Section ${h.section}` : null,
                          cat?.class_unit ? `${cat.class_unit} credits` : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>

          <p className="mt-2 text-[11px] leading-relaxed text-subtle">
            Only classes with something posted in Moodle show up here, so this may not be all of
            them. Titles and credits come from Concordia&rsquo;s calendar.
          </p>

          <button
            type="button"
            disabled={busy || picked.size === 0}
            onClick={() => void add()}
            className={cn(
              'mt-2 inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5',
              'text-[12.5px] font-medium text-accent-contrast transition-opacity hover:opacity-90',
              'disabled:opacity-50',
            )}
          >
            {busy ? (
              <Loader2 size={13} className="animate-spin" aria-hidden />
            ) : picked.size > 0 ? (
              <Plus size={13} aria-hidden />
            ) : (
              <Check size={13} aria-hidden />
            )}
            Add {picked.size} {picked.size === 1 ? 'course' : 'courses'}
          </button>
        </>
      )}
    </div>
  )
}
