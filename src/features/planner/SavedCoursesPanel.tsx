import { useCallback, useEffect, useMemo, useState } from 'react'
import { Bookmark, Columns2, Loader2, Trash2 } from 'lucide-react'
import { Select } from '@/components/ui/Select'
import { useAppData } from '@/app/providers/app-data'
import { loadAcademicProfile, summarizeRecord } from '@/lib/academic-record'
import { checkPrereq, normalizeCode } from '@/lib/prereq'
import { searchCourses, type CatalogCourse } from '@/lib/catalog'
import {
  listSaved,
  unsaveCourse,
  updateSaved,
  workloadFor,
  type SavedCourse,
  type Workload,
} from '@/lib/saved-courses'
import { cn } from '@/lib/cn'
import { futureTerms } from './past-terms'

/**
 * The shortlist, and a way to choose between what is on it.
 *
 * Deciding a semester is a comparison, not a sequence of lookups: you hold four
 * courses in your head and pick three. So the list carries your own note and
 * intended term, and any two or more can be put side by side.
 */
export function SavedCoursesPanel() {
  const { pastCourses, courses, assessments } = useAppData()
  const [saved, setSaved] = useState<SavedCourse[] | null>(null)
  const [details, setDetails] = useState<Map<string, CatalogCourse>>(new Map())
  const [work, setWork] = useState<Map<string, Workload>>(new Map())
  const [compare, setCompare] = useState<Set<string>>(new Set())
  const [trusted, setTrusted] = useState(false)
  const [tick, setTick] = useState(0)
  const refresh = useCallback(() => setTick((n) => n + 1), [])

  useEffect(() => {
    let alive = true
    void (async () => {
      const [rows, profile] = await Promise.all([listSaved(), loadAcademicProfile()])
      if (!alive) return
      setSaved(rows)
      setTrusted(profile.recordComplete)
      const [found, loads] = await Promise.all([
        Promise.all(rows.map((r) => searchCourses(r.code, 1).catch(() => []))),
        workloadFor(rows.map((r) => r.code)),
      ])
      if (!alive) return
      setDetails(new Map(found.flat().map((c) => [`${c.subject} ${c.catalog}`, c])))
      setWork(loads)
    })()
    return () => {
      alive = false
    }
  }, [tick])

  const record = useMemo(() => {
    const summary = summarizeRecord(pastCourses, assessments)
    const codes = new Set(summary.completedCodes.map(normalizeCode))
    for (const c of courses) if (c.code.trim()) codes.add(normalizeCode(c.code))
    return { completed: codes, credits: summary.credits }
  }, [pastCourses, courses, assessments])

  if (saved === null) {
    return (
      <div className="grid place-items-center py-14">
        <Loader2 className="size-5 animate-spin text-accent" aria-hidden />
      </div>
    )
  }

  if (saved.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border px-6 py-14 text-center">
        <Bookmark size={22} className="mx-auto text-subtle" aria-hidden />
        <h2 className="mt-2 font-display text-[17px] font-medium text-fg">Nothing saved yet</h2>
        <p className="mx-auto mt-1 max-w-sm text-[13px] leading-relaxed text-subtle">
          Save a course from the directory and it lands here, where you can keep a note, mark which
          term you plan to take it, and compare it against the others you are weighing up.
        </p>
      </div>
    )
  }

  const selected = saved.filter((s) => compare.has(s.code))

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13px] text-subtle">
          {saved.length} saved{compare.size > 0 ? ` · ${compare.size} selected` : ''}
        </p>
        {compare.size > 0 && (
          <button
            type="button"
            onClick={() => setCompare(new Set())}
            className="text-[12px] text-subtle transition-colors duration-150 hover:text-fg"
          >
            Clear selection
          </button>
        )}
      </div>

      {selected.length >= 2 && (
        <CompareTable
          rows={selected}
          details={details}
          work={work}
          record={record}
          trusted={trusted}
        />
      )}

      <ul className="space-y-2">
        {saved.map((s) => (
          <SavedRow
            key={s.id}
            saved={s}
            detail={details.get(s.code)}
            workload={work.get(s.code)}
            record={record}
            trusted={trusted}
            selected={compare.has(s.code)}
            onToggleCompare={() =>
              setCompare((prev) => {
                const next = new Set(prev)
                if (next.has(s.code)) next.delete(s.code)
                else next.add(s.code)
                return next
              })
            }
            onChanged={refresh}
          />
        ))}
      </ul>
    </div>
  )
}

function SavedRow({
  saved,
  detail,
  workload,
  record,
  trusted,
  selected,
  onToggleCompare,
  onChanged,
}: {
  saved: SavedCourse
  detail: CatalogCourse | undefined
  workload: Workload | undefined
  record: { completed: Set<string>; credits: number }
  trusted: boolean
  selected: boolean
  onToggleCompare: () => void
  onChanged: () => void
}) {
  const [note, setNote] = useState(saved.note ?? '')
  const [term, setTerm] = useState(saved.planned_term ?? '')
  const verdict = detail?.prerequisites
    ? checkPrereq(detail.prerequisites, record).verdict
    : null

  return (
    <li
      className={cn(
        'rounded-xl border bg-surface p-3.5 transition-colors duration-150',
        selected ? 'border-accent' : 'border-border',
      )}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={onToggleCompare}
          aria-pressed={selected}
          aria-label={`Compare ${saved.code}`}
          className={cn(
            'mt-0.5 grid size-5 shrink-0 place-items-center rounded border transition-colors duration-150',
            selected ? 'border-accent bg-accent text-accent-contrast' : 'border-border text-transparent hover:border-accent',
          )}
        >
          <Columns2 size={11} aria-hidden />
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2">
            <span className="text-[13.5px] font-semibold text-fg">{saved.code}</span>
            <span className="truncate text-[12.5px] text-subtle">
              {detail?.title ?? saved.title ?? ''}
            </span>
            {trusted && verdict === 'met' && (
              <span className="rounded bg-success/15 px-1.5 py-0.5 text-[10.5px] font-medium text-success">
                Prerequisites met
              </span>
            )}
            {trusted && verdict === 'not-met' && (
              <span className="rounded bg-danger/15 px-1.5 py-0.5 text-[10.5px] font-medium text-danger">
                Prerequisites not met
              </span>
            )}
            {trusted && verdict === 'blocked' && (
              <span className="rounded bg-danger/15 px-1.5 py-0.5 text-[10.5px] font-medium text-danger">
                Cannot take
              </span>
            )}
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-x-3 text-[11.5px] text-subtle">
            {detail?.class_unit != null && <span>{detail.class_unit} credits</span>}
            {/* Only ever from real shared outlines, and it says how many, so a
                sample of one reads as a sample of one. */}
            {workload ? (
              <span>
                {workload.assessments} graded items · biggest {workload.heaviest}% (from{' '}
                {workload.outlines} outline{workload.outlines === 1 ? '' : 's'})
              </span>
            ) : (
              <span>No shared outline yet, so no workload to show</span>
            )}
          </div>

          <div className="mt-2.5 grid gap-2 sm:grid-cols-[1fr_170px]">
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onBlur={() => {
                if (note !== (saved.note ?? '')) void updateSaved(saved.id, { note: note || null })
              }}
              placeholder="Why you saved it, who teaches it, what you heard"
              aria-label={`Note for ${saved.code}`}
              className="w-full rounded-lg border border-border bg-canvas px-3 py-2 text-[12.5px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none"
            />
            <Select
              value={term}
              onChange={(next) => {
                setTerm(next)
                void updateSaved(saved.id, { planned_term: next || null })
              }}
              ariaLabel={`Planned term for ${saved.code}`}
              placeholder="When?"
              size="sm"
              options={[{ value: '', label: 'No term yet' }, ...futureTerms().map((x) => ({ value: x, label: x }))]}
            />
          </div>
        </div>

        <button
          type="button"
          onClick={() => void unsaveCourse(saved.code).then(onChanged)}
          aria-label={`Remove ${saved.code}`}
          className="grid size-7 shrink-0 place-items-center rounded-md text-subtle transition-colors duration-150 hover:bg-surface-2 hover:text-danger"
        >
          <Trash2 size={13} aria-hidden />
        </button>
      </div>
    </li>
  )
}

/** The saved courses you ticked, side by side. */
function CompareTable({
  rows,
  details,
  work,
  record,
  trusted,
}: {
  rows: SavedCourse[]
  details: Map<string, CatalogCourse>
  work: Map<string, Workload>
  record: { completed: Set<string>; credits: number }
  trusted: boolean
}) {
  const field = (label: string, render: (s: SavedCourse) => React.ReactNode) => (
    <tr className="border-t border-border/60">
      <th scope="row" className="py-2 pr-3 text-left align-top text-[11.5px] font-medium text-subtle">
        {label}
      </th>
      {rows.map((s) => (
        <td key={s.id} className="py-2 pr-3 align-top text-[12.5px] text-fg">
          {render(s)}
        </td>
      ))}
    </tr>
  )

  return (
    <div className="mb-4 overflow-x-auto rounded-xl border border-border bg-surface p-3.5">
      <table className="w-full min-w-[520px] border-collapse">
        <thead>
          <tr>
            <th className="w-28" />
            {rows.map((s) => (
              <th key={s.id} scope="col" className="pb-1 pr-3 text-left">
                <span className="block text-[13px] font-semibold text-fg">{s.code}</span>
                <span className="block truncate text-[11.5px] font-normal text-subtle">
                  {details.get(s.code)?.title ?? s.title ?? ''}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {field('Credits', (s) => details.get(s.code)?.class_unit ?? '—')}
          {field('Graded items', (s) => {
            const w = work.get(s.code)
            return w ? `${w.assessments} avg` : <span className="text-subtle">unknown</span>
          })}
          {field('Biggest item', (s) => {
            const w = work.get(s.code)
            return w ? `${w.heaviest}%` : <span className="text-subtle">unknown</span>
          })}
          {field('Prerequisites', (s) => {
            const d = details.get(s.code)
            if (!d?.prerequisites) return <span className="text-subtle">None listed</span>
            if (!trusted) return <span className="text-subtle">Complete your record to check</span>
            const v = checkPrereq(d.prerequisites, record).verdict
            return (
              <span
                className={cn(
                  'font-medium',
                  v === 'met' && 'text-success',
                  (v === 'not-met' || v === 'blocked') && 'text-danger',
                  v === 'unknown' && 'text-warning',
                )}
              >
                {v === 'met' ? 'Met' : v === 'not-met' ? 'Not met' : v === 'blocked' ? 'Cannot take' : 'Unclear'}
              </span>
            )
          })}
          {field('Planned', (s) => s.planned_term ?? <span className="text-subtle">—</span>)}
          {field('Your note', (s) => s.note ?? <span className="text-subtle">—</span>)}
        </tbody>
      </table>
      <p className="mt-2 text-[11px] text-subtle">
        Workload is averaged from outlines students have shared. Courses without one show nothing
        rather than a guess.
      </p>
    </div>
  )
}
