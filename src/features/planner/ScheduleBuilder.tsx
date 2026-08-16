import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Bus, Loader2, Plus, Search, X } from 'lucide-react'
import { COURSE_COLORS } from '@/lib/course-color'
import { findSections, termLabel, type SectionOption } from '@/lib/seats'
import { newestTerm, parseCourseCode, sortSections } from '@/lib/course-sections'
import { listSaved } from '@/lib/saved-courses'
import { weekdayNames } from '@/lib/date'
import { cn } from '@/lib/cn'
import {
  daysOff,
  findCampusGaps,
  findConflicts,
  gridBounds,
  placeSections,
  toMinutes,
  weeklyHours,
} from './schedule'

/**
 * Build a week from real sections.
 *
 * Shaped like Concordia's own builder because that is what students already
 * know: courses on the left, the week on the right, one colour per course. What
 * theirs does not do is tell you what is wrong with the result, so that is
 * where the effort goes - overlaps, and the cross-campus gaps that quietly make
 * you late because the shuttle takes half an hour.
 *
 * Nothing here registers you for anything. It is a planning surface, and it
 * says so, because a schedule that looks official but is not is worse than one
 * that is obviously a sketch.
 */

interface Picked {
  code: string
  section: SectionOption
  colour: number
}

export function ScheduleBuilder() {
  const [picked, setPicked] = useState<Picked[]>([])
  const [query, setQuery] = useState('')
  const [options, setOptions] = useState<SectionOption[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [term, setTerm] = useState('')
  const [suggestions, setSuggestions] = useState<string[]>([])

  useEffect(() => {
    let alive = true
    void listSaved().then((rows) => {
      if (alive) setSuggestions(rows.map((r) => r.code).slice(0, 8))
    })
    return () => {
      alive = false
    }
  }, [])

  const lookup = useCallback(async (raw: string) => {
    const parsed = parseCourseCode(raw)
    if (!parsed) {
      setError('Enter a course code like COMP 248.')
      return
    }
    setLoading(true)
    setError(null)
    setOptions(null)
    try {
      const rows = await findSections(parsed.subject, parsed.catalog)
      setOptions(rows)
      setTerm((t) => t || newestTerm(rows) || '')
      if (rows.length === 0) setError('Concordia lists no sections for that course.')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not reach Concordia.')
    } finally {
      setLoading(false)
    }
  }, [])

  const placed = useMemo(
    () => placeSections(picked.map((p) => ({ code: p.code, section: p.section }))),
    [picked],
  )
  const conflicts = useMemo(() => findConflicts(placed), [placed])
  const gaps = useMemo(() => findCampusGaps(placed), [placed])
  const colourOf = useMemo(() => {
    const map = new Map<string, string>()
    for (const p of picked) map.set(p.code, COURSE_COLORS[p.colour % COURSE_COLORS.length].hex)
    return map
  }, [picked])

  function add(section: SectionOption, code: string) {
    setPicked((prev) => {
      if (prev.some((p) => p.section.classNumber === section.classNumber)) return prev
      // One colour per COURSE, so a lecture and its tutorial read as the same
      // class rather than two unrelated blocks.
      const existing = prev.find((p) => p.code === code)
      const colour = existing ? existing.colour : prev.length
      return [...prev, { code, section, colour }]
    })
  }

  const visible = options ? sortSections(options.filter((s) => !term || s.termCode === term)) : []
  const terms = [...new Set((options ?? []).map((s) => s.termCode))].sort((a, b) => b.localeCompare(a))

  return (
    <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
      {/* ── Left: choose ─────────────────────────────────────────────── */}
      <div className="min-w-0">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void lookup(query)
          }}
          className="grid grid-cols-[minmax(0,1fr)_auto] gap-2"
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
              placeholder="Add a course, e.g. COMP 248"
              aria-label="Add a course by code"
              className="w-full rounded-lg border border-border bg-canvas py-2 pr-3 pl-9 text-[13px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-[13px] font-medium whitespace-nowrap text-accent-contrast transition-colors duration-150 hover:bg-accent-hover disabled:opacity-60"
          >
            {loading ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Plus size={14} aria-hidden />}
            Find
          </button>
        </form>

        {suggestions.length > 0 && options === null && (
          <div className="mt-2">
            <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-subtle uppercase">
              From your saved courses
            </p>
            <div className="flex flex-wrap gap-1.5">
              {suggestions.map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => {
                    setQuery(code)
                    void lookup(code)
                  }}
                  className="rounded border border-border px-2 py-1 text-[11.5px] text-muted transition-colors duration-150 hover:border-accent hover:text-fg"
                >
                  {code}
                </button>
              ))}
            </div>
          </div>
        )}

        {error && <p className="mt-2 text-[12px] text-danger">{error}</p>}

        {options !== null && visible.length > 0 && (
          <div className="mt-3">
            {terms.length > 1 && (
              <div className="mb-1.5 flex flex-wrap gap-1.5">
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
            )}
            <ul className="max-h-64 divide-y divide-border overflow-y-auto rounded-lg border border-border">
              {visible.map((s) => {
                const code = `${parseCourseCode(query)?.subject ?? ''} ${parseCourseCode(query)?.catalog ?? ''}`.trim()
                const already = picked.some((p) => p.section.classNumber === s.classNumber)
                const free =
                  s.capacity !== null && s.enrolled !== null ? s.capacity - s.enrolled : null
                return (
                  <li key={s.classNumber}>
                    <button
                      type="button"
                      onClick={() => add(s, code)}
                      disabled={already}
                      className="flex w-full items-start gap-2 px-3 py-2 text-left transition-colors duration-150 hover:bg-surface-2 disabled:opacity-50"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block text-[12.5px] font-medium text-fg">
                          {s.section} · {s.component}
                        </span>
                        <span className="block text-[11.5px] text-subtle">
                          {s.meetingTimes ?? 'Time TBA'}
                        </span>
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
          </div>
        )}

        {picked.length > 0 && (
          <div className="mt-4">
            <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-subtle uppercase">
              In this schedule
            </p>
            <ul className="space-y-1.5">
              {picked.map((p) => (
                <li
                  key={p.section.classNumber}
                  className="flex items-center gap-2 rounded-lg border border-border bg-surface px-2.5 py-2"
                >
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: colourOf.get(p.code) }}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] font-medium text-fg">
                      {p.code} {p.section.section} · {p.section.component}
                    </span>
                    <span className="block truncate text-[11px] text-subtle">
                      {p.section.meetingTimes ?? 'Time TBA'}
                      {p.section.location ? ` · ${p.section.location}` : ''}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setPicked((prev) =>
                        prev.filter((x) => x.section.classNumber !== p.section.classNumber),
                      )
                    }
                    aria-label={`Remove ${p.code} ${p.section.section}`}
                    className="grid size-6 shrink-0 place-items-center rounded text-subtle transition-colors duration-150 hover:text-danger"
                  >
                    <X size={12} aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* ── Right: the week ──────────────────────────────────────────── */}
      <div className="min-w-0">
        {placed.length === 0 ? (
          <div className="grid h-64 place-items-center rounded-xl border border-dashed border-border px-6 text-center">
            <p className="text-[13px] text-subtle">
              Add a course and its sections appear here as a week.
            </p>
          </div>
        ) : (
          <>
            <WeekGrid placed={placed} colourOf={colourOf} conflicts={conflicts} />

            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-subtle">
              <span>{weeklyHours(placed)} hours a week</span>
              {daysOff(placed).length > 0 && (
                <span>
                  Free:{' '}
                  {daysOff(placed)
                    .map((d) => weekdayNames()[d])
                    .join(', ')}
                </span>
              )}
            </div>

            {conflicts.length > 0 && (
              <div className="mt-3 rounded-lg border border-danger/40 bg-danger/10 px-3.5 py-2.5">
                <p className="flex items-center gap-1.5 text-[12.5px] font-medium text-fg">
                  <AlertTriangle size={13} className="text-danger" aria-hidden />
                  {conflicts.length} overlap{conflicts.length === 1 ? '' : 's'}
                </p>
                <ul className="mt-1 space-y-0.5">
                  {conflicts.map((c, i) => (
                    <li key={i} className="text-[12px] text-muted">
                      {c.a.code} and {c.b.code} overlap by {c.minutes} minutes on{' '}
                      {weekdayNames()[c.day]}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {gaps.length > 0 && (
              <div className="mt-2 rounded-lg border border-warning/40 bg-warning/10 px-3.5 py-2.5">
                <p className="flex items-center gap-1.5 text-[12.5px] font-medium text-fg">
                  <Bus size={13} className="text-warning" aria-hidden />
                  Tight campus changes
                </p>
                <ul className="mt-1 space-y-0.5">
                  {gaps.map((g, i) => (
                    <li key={i} className="text-[12px] text-muted">
                      {g.minutes} minutes from {g.from.code} ({g.from.section.location}) to {g.to.code}{' '}
                      ({g.to.section.location}) on {weekdayNames()[g.day]}. The shuttle takes about
                      30 minutes before waiting.
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <p className="mt-3 text-[11px] text-subtle">
              A plan, not a registration. Seat counts were read when you added each section and can
              change; register in the Student Centre.
            </p>
          </>
        )}
      </div>
    </div>
  )
}

function WeekGrid({
  placed,
  colourOf,
  conflicts,
}: {
  placed: ReturnType<typeof placeSections>
  colourOf: Map<string, string>
  conflicts: ReturnType<typeof findConflicts>
}) {
  const { start, end } = gridBounds(placed)
  const span = Math.max(end - start, 60)
  const hours = Array.from({ length: Math.ceil(span / 60) + 1 }, (_, i) => start + i * 60)
  const days = [1, 2, 3, 4, 5]
  const names = weekdayNames()
  const clashing = new Set(conflicts.flatMap((c) => [c.a, c.b]).map((p) => p.section.classNumber + p.slot.day + p.slot.start))

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface">
      <div className="min-w-[520px]">
        <div className="grid grid-cols-[44px_repeat(5,1fr)] border-b border-border">
          <span />
          {days.map((d) => (
            <span key={d} className="px-2 py-1.5 text-center text-[11.5px] font-medium text-subtle">
              {names[d].slice(0, 3)}
            </span>
          ))}
        </div>

        <div className="relative grid grid-cols-[44px_repeat(5,1fr)]" style={{ height: span * 0.9 }}>
          {/* Hour rules and labels */}
          <div className="relative">
            {hours.map((m) => (
              <span
                key={m}
                className="absolute right-1.5 -translate-y-1/2 text-[10.5px] text-subtle tabular-nums"
                style={{ top: (m - start) * 0.9 }}
              >
                {String(Math.floor(m / 60)).padStart(2, '0')}:00
              </span>
            ))}
          </div>

          {days.map((day) => (
            <div key={day} className="relative border-l border-border/60">
              {hours.map((m) => (
                <span
                  key={m}
                  className="absolute inset-x-0 border-t border-border/40"
                  style={{ top: (m - start) * 0.9 }}
                  aria-hidden
                />
              ))}
              {placed
                .filter((p) => p.slot.day === day)
                .map((p, i) => {
                  const top = (toMinutes(p.slot.start) - start) * 0.9
                  const height = Math.max((toMinutes(p.slot.end) - toMinutes(p.slot.start)) * 0.9, 18)
                  const hex = colourOf.get(p.code) ?? '#888'
                  const clash = clashing.has(p.section.classNumber + p.slot.day + p.slot.start)
                  return (
                    <div
                      key={`${p.section.classNumber}-${i}`}
                      className={cn(
                        'absolute inset-x-0.5 overflow-hidden rounded px-1.5 py-1 text-[10.5px] leading-tight',
                        // An overlap is outlined rather than recoloured, so the
                        // course keeps its identity colour while still being
                        // obviously in trouble.
                        clash && 'ring-2 ring-danger',
                      )}
                      style={{ top, height, backgroundColor: `${hex}33`, borderLeft: `3px solid ${hex}` }}
                      title={`${p.code} ${p.section.section} ${p.slot.start}–${p.slot.end}`}
                    >
                      <span className="block truncate font-medium text-fg">{p.code}</span>
                      <span className="block truncate text-subtle">
                        {p.slot.start}–{p.slot.end}
                      </span>
                    </div>
                  )
                })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
