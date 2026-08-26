import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, Loader2, Search } from 'lucide-react'
import { findSections, termLabel, type SectionOption } from '@/lib/seats'
import { parseCourseCode, sortSections } from '@/lib/course-sections'
import { checkPrereq } from '@/lib/prereq'
import { searchCourses, type CatalogCourse } from '@/lib/catalog'
import { cn } from '@/lib/cn'
import { SectionSkeleton } from '@/components/ui/Skeleton'
import { clashesWithBlocks, type Block } from './schedule'

/**
 * The left pane: find a course, see its sections, add one.
 *
 * Two steps, and the order matters. Typing shows COURSES — code and title, from
 * the catalogue, as you type — and only picking one goes and fetches its
 * sections from Concordia. It used to do the opposite: every search fired the
 * slow section lookup, so you waited seconds to find out you had typed the wrong
 * number. Now the wait happens once, after you already know it is the right
 * course.
 *
 * Sections that clash with a blocked time are greyed and labelled, not removed.
 * A student who blocked Friday mornings for work may still want to see the
 * Friday section and decide; deleting it from the list would look like the
 * course is not offered.
 */
export function ScheduleSearch({
  initialQuery = '',
  blocks,
  termCode,
  onTermFound,
  onAdd,
  taken,
  eligibleOnly,
  record,
}: {
  /** Seeded when a suggestion is clicked. The parent remounts on change (a
   *  `key`), so this is an initial value and never fights what you type. */
  initialQuery?: string
  blocks: Block[]
  termCode: string
  onTermFound: (terms: string[]) => void
  onAdd: (code: string, section: SectionOption) => void
  taken: Set<string>
  eligibleOnly: boolean
  record: { completed: Set<string>; credits: number }
}) {
  const [query, setQuery] = useState(initialQuery)
  const [matches, setMatches] = useState<CatalogCourse[] | null>(null)
  const [searching, setSearching] = useState(false)

  const [chosen, setChosen] = useState<CatalogCourse | null>(null)
  const [code, setCode] = useState('')
  const [options, setOptions] = useState<SectionOption[] | null>(null)
  const [prereqNote, setPrereqNote] = useState<string | null>(null)
  const [blockedByPrereq, setBlockedByPrereq] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Suggestions as you type. Debounced, and cheap: one indexed query against
  // our own mirror, not a round trip to Concordia for every section of every
  // near-miss.
  const q = query.trim()
  // Derived, not stored: one character is a typo, not a search. Keeping this
  // out of state also keeps the effect free of a synchronous setState, which
  // React (and the lint rule) rightly object to.
  const suggesting = !chosen && q.length >= 2

  useEffect(() => {
    if (!suggesting) return
    let alive = true
    const timer = setTimeout(() => {
      setSearching(true)
      searchCourses(q, 8)
        .then((rows) => alive && setMatches(rows))
        .catch(() => alive && setMatches([]))
        .finally(() => alive && setSearching(false))
    }, 220)
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [q, suggesting])

  const choose = useCallback(
    async (course: CatalogCourse) => {
      const label = `${course.subject} ${course.catalog}`
      setChosen(course)
      setCode(label)
      setMatches(null)
      setLoading(true)
      setError(null)
      setOptions(null)
      setPrereqNote(null)
      setBlockedByPrereq(false)
      try {
        const rows = await findSections(course.subject, course.catalog)
        setOptions(rows)
        onTermFound([...new Set(rows.map((s) => s.termCode))])
        if (rows.length === 0) setError('Concordia lists no sections for this course right now.')

        if (course.prerequisites) {
          const result = checkPrereq(course.prerequisites, record)
          setBlockedByPrereq(result.verdict === 'not-met' || result.verdict === 'blocked')
          if (result.verdict === 'not-met') setPrereqNote('You do not meet the prerequisites yet.')
          else if (result.verdict === 'blocked') setPrereqNote(result.notes[0] ?? 'Cannot be taken.')
          else if (result.verdict === 'unknown')
            setPrereqNote('Prerequisites depend on something we cannot check.')
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Could not reach Concordia.')
      } finally {
        setLoading(false)
      }
    },
    [onTermFound, record],
  )

  /** Someone who types a whole code and hits Enter should not have to aim. */
  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (matches?.length) {
      void choose(matches[0])
      return
    }
    const parsed = parseCourseCode(query)
    if (parsed) {
      void choose({
        id: '',
        subject: parsed.subject,
        catalog: parsed.catalog,
        title: '',
        career: null,
        class_unit: null,
        prerequisites: null,
      })
    } else setError('Enter a course code like COMP 248, or part of a course name.')
  }

  function reset() {
    setChosen(null)
    setOptions(null)
    setPrereqNote(null)
    setError(null)
    setQuery('')
  }

  const visible = options
    ? sortSections(options.filter((s) => !termCode || s.termCode === termCode))
    : []
  const hiddenByFilter = eligibleOnly && blockedByPrereq

  return (
    <div className="min-w-0">
      {chosen ? (
        <button
          type="button"
          onClick={reset}
          className="flex w-full items-center gap-1.5 rounded-lg border border-border bg-canvas px-2.5 py-2 text-left text-[12.5px] transition-colors duration-150 hover:border-border-strong"
        >
          <ArrowLeft size={13} className="shrink-0 text-subtle" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block font-semibold text-fg">{code}</span>
            {chosen.title && <span className="block truncate text-[11px] text-subtle">{chosen.title}</span>}
          </span>
        </button>
      ) : (
        <form onSubmit={submit}>
          <div className="relative">
            <Search
              size={15}
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-subtle"
            />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setError(null)
              }}
              placeholder="Course code or name"
              aria-label="Find a course"
              className="w-full rounded-lg border border-border bg-canvas py-2 pr-8 pl-9 text-[13px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none"
            />
            {searching && (
              <Loader2
                size={14}
                className="absolute top-1/2 right-3 -translate-y-1/2 animate-spin text-subtle"
                aria-hidden
              />
            )}
          </div>
        </form>
      )}

      {/* Course suggestions: names first, so you can tell COMP 352 from COMP 353
          before waiting on either one's sections. */}
      {suggesting && matches === null && searching && (
        <div className="mt-2">
          <SectionSkeleton rows={3} />
        </div>
      )}

      {suggesting && matches !== null && (
        <ul className="mt-2 divide-y divide-border overflow-hidden rounded-lg border border-border">
          {matches.length === 0 ? (
            <li className="px-3 py-2.5 text-[12px] text-subtle">
              No course in the calendar matches that.
            </li>
          ) : (
            matches.map((c) => (
              <li key={c.id || `${c.subject}${c.catalog}`}>
                <button
                  type="button"
                  onClick={() => void choose(c)}
                  className="w-full px-3 py-2 text-left transition-colors duration-150 hover:bg-surface-2"
                >
                  <span className="block text-[12.5px] font-medium text-fg">
                    {c.subject} {c.catalog}
                  </span>
                  <span className="block truncate text-[11.5px] text-subtle">{c.title}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}

      {/* Sections come from Concordia and take a couple of seconds, which is
          long enough that a spinner alone reads as a stall. The skeleton holds
          the shape the rows will take, so nothing jumps when they land. */}
      {loading && (
        <>
          <p className="mt-2 flex items-center gap-1.5 text-[12px] text-subtle">
            <Loader2 size={13} className="animate-spin" aria-hidden />
            Looking up sections at Concordia…
          </p>
          <SectionSkeleton />
        </>
      )}

      {error && <p className="mt-2 text-[12px] text-danger">{error}</p>}

      {prereqNote && (
        <p className={cn('mt-2 text-[11.5px]', blockedByPrereq ? 'text-danger' : 'text-warning')}>
          {prereqNote}
        </p>
      )}

      {hiddenByFilter && (
        <p className="mt-2 rounded-lg border border-border bg-surface-2 px-3 py-2 text-[11.5px] text-subtle">
          Hidden by the eligibility filter. Turn it off to add this anyway.
        </p>
      )}

      {options !== null && visible.length > 0 && !hiddenByFilter && (
        <ul className="mt-3 max-h-[46vh] divide-y divide-border overflow-y-auto rounded-lg border border-border">
          {visible.map((s) => {
            const already = taken.has(s.classNumber)
            const hits = clashesWithBlocks(s.meetingTimes, blocks)
            const free = s.capacity !== null && s.enrolled !== null ? s.capacity - s.enrolled : null
            return (
              <li key={s.classNumber}>
                <button
                  type="button"
                  onClick={() => onAdd(code, s)}
                  disabled={already}
                  className={cn(
                    'flex w-full items-start gap-2 px-3 py-2 text-left transition-colors duration-150 hover:bg-surface-2 disabled:opacity-40',
                    hits.length > 0 && 'opacity-60',
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12.5px] font-medium text-fg">
                      {s.section} · {s.component}
                      {termCode ? '' : ` · ${termLabel(s.termCode)}`}
                    </span>
                    <span className="block text-[11.5px] text-subtle">
                      {s.meetingTimes ?? 'Time TBA'}
                      {s.location ? ` · ${s.location}` : ''}
                    </span>
                    {hits.length > 0 && (
                      <span className="block text-[11px] text-warning">
                        Clashes with {hits.map((b) => b.label).join(', ')}
                      </span>
                    )}
                  </span>
                  <span
                    className={cn(
                      'shrink-0 text-[11px] font-medium tabular-nums',
                      free !== null && free > 0 ? 'text-success' : 'text-warning',
                    )}
                  >
                    {free === null ? '' : free > 0 ? `${free} open` : 'Full'}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
