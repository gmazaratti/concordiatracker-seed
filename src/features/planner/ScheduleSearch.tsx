import { useCallback, useState } from 'react'
import { Loader2, Plus, Search } from 'lucide-react'
import { findSections, termLabel, type SectionOption } from '@/lib/seats'
import { parseCourseCode, sortSections } from '@/lib/course-sections'
import { checkPrereq } from '@/lib/prereq'
import { searchCourses } from '@/lib/catalog'
import { cn } from '@/lib/cn'
import { clashesWithBlocks, type Block } from './schedule'

/**
 * The left pane: find a course, see its sections, add one.
 *
 * Sections that clash with a blocked time are greyed and labelled, not removed.
 * A student who blocked Friday mornings for work may still want to see the
 * Friday section and decide; deleting it from the list would look like the
 * course is not offered.
 */
export function ScheduleSearch({
  blocks,
  termCode,
  onTermFound,
  onAdd,
  taken,
  eligibleOnly,
  record,
}: {
  blocks: Block[]
  termCode: string
  onTermFound: (terms: string[]) => void
  onAdd: (code: string, section: SectionOption) => void
  taken: Set<string>
  eligibleOnly: boolean
  record: { completed: Set<string>; credits: number }
}) {
  const [query, setQuery] = useState('')
  const [code, setCode] = useState('')
  const [options, setOptions] = useState<SectionOption[] | null>(null)
  const [prereqNote, setPrereqNote] = useState<string | null>(null)
  const [blockedByPrereq, setBlockedByPrereq] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const lookup = useCallback(
    async (raw: string) => {
      const parsed = parseCourseCode(raw)
      if (!parsed) {
        setError('Enter a course code like COMP 248.')
        return
      }
      setLoading(true)
      setError(null)
      setOptions(null)
      setPrereqNote(null)
      setBlockedByPrereq(false)
      const label = `${parsed.subject} ${parsed.catalog}`
      setCode(label)
      try {
        const [rows, catalogue] = await Promise.all([
          findSections(parsed.subject, parsed.catalog),
          searchCourses(label, 1).catch(() => []),
        ])
        setOptions(rows)
        onTermFound([...new Set(rows.map((s) => s.termCode))])
        if (rows.length === 0) setError('Concordia lists no sections for that course.')

        const prereq = catalogue[0]?.prerequisites
        if (prereq) {
          const result = checkPrereq(prereq, record)
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

  const visible = options
    ? sortSections(options.filter((s) => !termCode || s.termCode === termCode))
    : []
  const hiddenByFilter = eligibleOnly && blockedByPrereq

  return (
    <div className="min-w-0">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void lookup(query)
        }}
        className="space-y-2"
      >
        <div className="relative">
          <Search
            size={15}
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-subtle"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Course code, e.g. COMP 248"
            aria-label="Add a course by code"
            className="w-full rounded-lg border border-border bg-canvas py-2 pr-3 pl-9 text-[13px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-[13px] font-medium whitespace-nowrap text-accent-contrast transition-colors duration-150 hover:bg-accent-hover disabled:opacity-60"
        >
          {loading ? (
            <Loader2 size={14} className="animate-spin" aria-hidden />
          ) : (
            <Plus size={14} aria-hidden />
          )}
          Find sections
        </button>
      </form>

      {error && <p className="mt-2 text-[12px] text-danger">{error}</p>}

      {prereqNote && (
        <p
          className={cn(
            'mt-2 text-[11.5px]',
            blockedByPrereq ? 'text-danger' : 'text-warning',
          )}
        >
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
