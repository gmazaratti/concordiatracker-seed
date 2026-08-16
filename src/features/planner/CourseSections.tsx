import { useState } from 'react'
import { Bell, Loader2, MapPin } from 'lucide-react'
import { findSections, termLabel, type SectionOption } from '@/lib/seats'
import { sortSections, newestTerm } from '@/lib/course-sections'
import { cn } from '@/lib/cn'

/**
 * When a course actually runs, where, and whether there is room.
 *
 * Loaded on demand rather than with the row: this is a live call to Concordia
 * per course, and firing one for every result in a list of ten would be rude to
 * them and slow for us. A student expands one course at a time anyway.
 */
export function CourseSections({ subject, catalog }: { subject: string; catalog: string }) {
  const [sections, setSections] = useState<SectionOption[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [term, setTerm] = useState<string>('')

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const rows = await findSections(subject, catalog)
      setSections(rows)
      setTerm(newestTerm(rows) ?? '')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not reach Concordia.')
    } finally {
      setLoading(false)
    }
  }

  if (sections === null) {
    return (
      <div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[12px] font-medium text-muted transition-colors duration-150 hover:border-accent hover:text-fg disabled:opacity-60"
        >
          {loading ? <Loader2 size={12} className="animate-spin" aria-hidden /> : null}
          {loading ? 'Checking Concordia' : 'Show sections and seats'}
        </button>
        {error && <p className="mt-1.5 text-[11.5px] text-danger">{error}</p>}
      </div>
    )
  }

  const terms = [...new Set(sections.map((s) => s.termCode))].sort((a, b) => b.localeCompare(a))
  const visible = sortSections(sections.filter((s) => s.termCode === term))

  if (sections.length === 0) {
    return (
      <p className="text-[12px] text-subtle">
        Concordia lists no scheduled sections for this course. It may not be offered this year.
      </p>
    )
  }

  return (
    <div>
      <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
        <p className="mr-1 text-[11px] font-semibold tracking-wide text-subtle uppercase">
          Sections
        </p>
        {terms.map((code) => (
          <button
            key={code}
            type="button"
            onClick={() => setTerm(code)}
            className={cn(
              'rounded border px-1.5 py-0.5 text-[11px] font-medium transition-colors duration-150',
              code === term
                ? 'border-accent bg-accent-soft text-accent'
                : 'border-border text-muted hover:text-fg',
            )}
          >
            {termLabel(code)}
          </button>
        ))}
      </div>

      <ul className="divide-y divide-border/60 overflow-hidden rounded-lg border border-border">
        {visible.map((s) => {
          const free =
            s.capacity !== null && s.enrolled !== null ? s.capacity - s.enrolled : null
          const isOpen = free !== null && free > 0
          return (
            <li key={s.classNumber} className="px-3 py-2">
              <div className="flex flex-wrap items-center gap-x-2 text-[12.5px]">
                <span className="font-medium text-fg">
                  {s.section} · {s.component}
                </span>
                <span className="text-subtle">{s.meetingTimes ?? 'Time TBA'}</span>
                {s.enrolled !== null && s.capacity !== null && (
                  <span
                    className={cn(
                      'ml-auto font-medium tabular-nums',
                      isOpen ? 'text-success' : 'text-warning',
                    )}
                  >
                    {isOpen ? `${free} open` : 'Full'}
                    <span className="ml-1 font-normal text-subtle">
                      ({s.enrolled}/{s.capacity})
                    </span>
                  </span>
                )}
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11.5px] text-subtle">
                {(s.building || s.location) && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin size={10} aria-hidden />
                    {[s.location, s.building && `${s.building}${s.room}`].filter(Boolean).join(' ')}
                  </span>
                )}
                {/* Waitlist depth is the number that says whether watching is
                    worth it, and nobody else shows it. */}
                {!isOpen && s.waitlisted ? (
                  <span className="inline-flex items-center gap-1">
                    <Bell size={10} aria-hidden />
                    {s.waitlisted} waitlisted
                  </span>
                ) : null}
                {s.hasReserved && <span>some seats reserved</span>}
                {s.instructionMode && <span>{s.instructionMode}</span>}
              </div>
            </li>
          )
        })}
      </ul>
      <p className="mt-1.5 text-[11px] text-subtle">
        Seat counts are read from Concordia when you open this, not stored.
      </p>
    </div>
  )
}
