import { useEffect, useMemo, useState } from 'react'
import { ArrowDownUp, Loader2, MapPin, Search, ShieldCheck, User } from 'lucide-react'
import { ModalShell } from '@/command/ModalShell'
import { Select } from '@/components/ui/Select'
import { cn } from '@/lib/cn'
import { sectionInstructors, type SectionInstructor } from '@/lib/academic-record'
import { addWatch, findSections, type SectionOption } from '@/lib/seats'
import {
  currentTermStatus,
  termCodeFor,
  termIsPast,
  termLabel,
} from '@/lib/course-sections'
import { currentTermName } from '@/features/planner/past-terms'

/**
 * Find a section and watch it.
 *
 * Sections are shown with their live seat counts, which does two jobs: it tells
 * you whether watching is even necessary, and it proves the numbers are real
 * before you rely on an alert built from them.
 */
export function SeatWatchModal({
  onClose,
  onAdded,
  initialCode,
}: {
  onClose: () => void
  onAdded: () => void
  /** Prefill the code, e.g. "COMP 248", when opened from a suggestion. */
  initialCode?: string
}) {
  const initial = initialCode?.trim().toUpperCase().match(/^([A-Z]{2,6})[\s-]*(\d{2,4}[A-Z]?)$/)
  const [subject, setSubject] = useState(initial?.[1] ?? '')
  const [catalog, setCatalog] = useState(initial?.[2] ?? '')
  const [sections, setSections] = useState<SectionOption[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [added, setAdded] = useState<string | null>(null)
  /**
   * Who teaches each section.
   *
   * Concordia's Open Data has NO instructor field: the schedule feed's 41
   * fields do not include one, and /course/faculty is faculty-and-department
   * structure rather than people. So this comes from our own outlines, and the
   * row says which kind it is instead of asserting a name we cannot source.
   */
  const [teachers, setTeachers] = useState<SectionInstructor[]>([])

  // Filters. Applied to the fetched list rather than re-queried, since one
  // course is a small result set and Concordia should be asked once.
  //
  // THE DEFAULT IS THE NEWEST TERM, NOT "ANY". Concordia's feed still carries
  // terms from two years ago, so "any" led with sections that finished long
  // ago — and the first thing on screen was an offer to watch a seat in a
  // class that is already over.
  const [term, setTerm] = useState('all')
  const [campus, setCampus] = useState('all')
  const [day, setDay] = useState('all')
  const [openOnly, setOpenOnly] = useState(false)
  const [sort, setSort] = useState<'default' | 'fewest' | 'most'>('default')

  // The term the student is sitting in, as a code. Read once per render
  // rather than per row, and never from inside the loop.
  const currentCode = termCodeFor(currentTermName())
  const status = currentTermStatus(
    sections?.map((s) => s.termCode) ?? [],
    currentCode,
  )
  // DERIVED, NOT ASSERTED. "Everything here has already ended" is true today,
  // when the feed stops two terms back — and false in July, when the current
  // term is unpublished but the following Fall is already listed. A banner
  // that states it either way is wrong half the year.
  const allOver =
    !!sections?.length && sections.every((s) => termIsPast(s.termCode, currentCode))

  const filtered = useMemo(() => {
    if (!sections) return null
    const free = (s: SectionOption) =>
      s.capacity !== null && s.enrolled !== null ? s.capacity - s.enrolled : -1
    return sections
      .filter((s) => term === 'all' || s.termCode === term)
      .filter((s) => campus === 'all' || s.location === campus)
      .filter((s) => day === 'all' || (s.meetingTimes ?? '').includes(day))
      .filter((s) => !openOnly || free(s) > 0)
      .sort((a, b) => {
        if (sort === 'fewest') return free(a) - free(b)
        if (sort === 'most') return free(b) - free(a)
        return 0
      })
  }, [sections, term, campus, day, openOnly, sort])

  // Options come from what actually came back, so a course taught only at SGW
  // never offers a Loyola filter that would return nothing.
  const terms = [...new Set(sections?.map((s) => s.termCode) ?? [])]
  const campuses = [...new Set((sections ?? []).map((s) => s.location).filter(Boolean))]

  // Refreshed alongside the section list, keyed off what was actually found.
  useEffect(() => {
    if (!sections || sections.length === 0) return
    let alive = true
    void sectionInstructors(`${subject.trim()} ${catalog.trim()}`).then((rows) => {
      if (alive) setTeachers(rows)
    })
    return () => {
      alive = false
    }
    // subject/catalog are frozen for a given result set; re-running on every
    // keystroke would query for a course nobody has searched yet.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections])

  async function search() {
    if (busy) return
    setBusy(true)
    setError(null)
    setSections(null)
    setTeachers([])
    try {
      const rows = await findSections(subject, catalog)
      setSections(rows)
      // Land on the term the student is in; failing that, the newest one the
      // feed has. Set HERE rather than in an effect — this is the moment the
      // options came into existence, and an effect would be a second source
      // of truth for the same choice (react-hooks/set-state-in-effect).
      const codes = [...new Set(rows.map((r) => r.termCode))].sort()
      const current = termCodeFor(currentTermName())
      setTerm(
        current && codes.includes(current) ? current : (codes[codes.length - 1] ?? 'all'),
      )
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not look that up.')
    } finally {
      setBusy(false)
    }
  }

  async function watch(s: SectionOption) {
    setError(null)
    try {
      await addWatch(s, subject.trim().toUpperCase(), catalog.trim())
      setAdded(s.classNumber)
      onAdded()
    } catch (e: unknown) {
      // The plan limit is enforced server-side, so this message is authoritative.
      setError(e instanceof Error ? e.message : 'Could not add that watch.')
    }
  }

  const field =
    'w-full rounded-lg border border-border bg-canvas px-3 py-2 text-[13.5px] text-fg uppercase placeholder:normal-case placeholder:text-subtle focus:border-accent focus:outline-none'

  return (
    <ModalShell label="Watch for a seat" onClose={onClose} widthClass="sm:max-w-lg" scroll={false}>
      <div className="flex h-[min(78vh,620px)] flex-col pb-[env(safe-area-inset-bottom)] sm:pb-0">
        <div className="border-b border-border p-4">
          <h2 className="font-display text-[17px] font-semibold text-fg">Watch for a seat</h2>
          <p className="mt-0.5 text-[12.5px] text-subtle">
            We check Concordia&rsquo;s course data and push you the moment a seat opens.
          </p>

          <div className="mt-3 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-2">
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void search()}
              placeholder="COMP"
              aria-label="Subject"
              maxLength={6}
              className={field}
            />
            <input
              value={catalog}
              onChange={(e) => setCatalog(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void search()}
              placeholder="248"
              aria-label="Course number"
              maxLength={4}
              className={field}
            />
            <button
              type="button"
              onClick={() => void search()}
              disabled={busy || !subject.trim() || !catalog.trim()}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-[13px] font-medium whitespace-nowrap text-accent-contrast transition-colors duration-150 hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? (
                <Loader2 size={14} className="animate-spin" aria-hidden />
              ) : (
                <Search size={14} aria-hidden />
              )}
              Find sections
            </button>
          </div>
          {error && <p className="mt-2 text-[12px] font-medium text-danger">{error}</p>}

          {sections && sections.length > 0 && (
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              <FilterSelect
                label="Term"
                value={term}
                onChange={setTerm}
                options={[
                  { value: 'all', label: 'Any term' },
                  // Newest first, and an ended term says so in the list
                  // rather than only once you have picked it.
                  ...[...terms]
                    .sort((a, b) => b.localeCompare(a))
                    .map((t) => ({
                      value: t,
                      label: termIsPast(t, currentCode)
                        ? `${termLabel(t)} · ended`
                        : termLabel(t),
                    })),
                ]}
              />
              {campuses.length > 1 && (
                <FilterSelect
                  label="Campus"
                  value={campus}
                  onChange={setCampus}
                  options={[
                    { value: 'all', label: 'Any campus' },
                    ...campuses.map((c) => ({ value: c, label: c })),
                  ]}
                />
              )}
              <FilterSelect
                label="Day"
                value={day}
                onChange={setDay}
                options={[
                  { value: 'all', label: 'Any day' },
                  ...['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((d) => ({ value: d, label: d })),
                ]}
              />
              <FilterSelect
                label="Sort"
                value={sort}
                onChange={(v) => setSort(v as typeof sort)}
                icon
                options={[
                  { value: 'default', label: 'Section order' },
                  { value: 'fewest', label: 'Fewest seats' },
                  { value: 'most', label: 'Most seats' },
                ]}
              />
              <button
                type="button"
                onClick={() => setOpenOnly((v) => !v)}
                aria-pressed={openOnly}
                className={cn(
                  'rounded-md border px-2 py-1 text-[11.5px] font-medium transition-colors duration-150',
                  openOnly
                    ? 'border-accent bg-accent-soft text-accent'
                    : 'border-border text-subtle hover:text-fg',
                )}
              >
                Open only
              </button>
            </div>
          )}
        </div>

        {/*
          THE QUESTION A STUDENT IS ACTUALLY ASKING is "can I get into this
          class, now". When the feed has nothing for the term they are in,
          every answer on screen is about some other semester, and saying so
          is the difference between a data gap and the app looking broken.
        */}
        {sections && sections.length > 0 && !status.published && (
          <p className="border-b border-border bg-warning/10 px-4 py-2.5 text-[11.5px] leading-snug text-muted">
            <span className="font-medium text-fg">
              Concordia hasn&rsquo;t published {currentTermName()} yet,
            </span>{' '}
            at least not to the course data we read.{' '}
            {status.newest
              ? `The newest it carries for this course is ${termLabel(status.newest)}.`
              : ''}{' '}
            {allOver
              ? 'Every section below is from a term that has already ended, so a seat opening in one would not be a seat you could take.'
              : 'You can still watch a term that has not started yet, but not the one you are in.'}
          </p>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto">
          {sections === null ? (
            <p className="px-4 py-10 text-center text-[13px] text-subtle">
              Enter a course code to see its sections and how full they are.
            </p>
          ) : filtered!.length === 0 ? (
            <p className="px-4 py-10 text-center text-[13px] text-subtle">
              {sections.length === 0
                ? 'No scheduled sections found for that course.'
                : 'No sections match those filters.'}
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {filtered!.map((s) => {
                const free =
                  s.capacity !== null && s.enrolled !== null ? s.capacity - s.enrolled : null
                const isOpen = free !== null && free > 0
                const teacher = teachers.find(
                  (x) => x.section.toUpperCase() === s.section.toUpperCase(),
                )
                const over = termIsPast(s.termCode, currentCode)
                return (
                  <li key={`${s.termCode}-${s.classNumber}`} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-x-2 text-[13px]">
                        <span className="font-medium text-fg">
                          {s.section} · {s.component}
                        </span>
                        <span
                          className={cn(
                            'text-[11.5px]',
                            over ? 'text-warning' : 'text-subtle',
                          )}
                        >
                          {termLabel(s.termCode)}
                          {over ? ' · ended' : ''}
                        </span>
                        {s.location && (
                          <span className="inline-flex items-center gap-1 text-[11.5px] text-subtle">
                            <MapPin size={10} aria-hidden />
                            {s.location} {s.building}
                            {s.room}
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 block text-[11.5px] text-subtle">
                        {s.meetingTimes ?? 'Time TBA'}
                        {s.enrolled !== null && s.capacity !== null && (
                          <>
                            {' · '}
                            <span className={isOpen ? 'text-success' : 'text-warning'}>
                              {s.enrolled}/{s.capacity} seats
                            </span>
                          </>
                        )}
                        {/* Waitlist depth is the number nobody else shows, and
                            it's what tells you whether watching is worthwhile. */}
                        {!isOpen && s.waitlisted ? ` · ${s.waitlisted} waitlisted` : ''}
                      </span>
                      {teacher && (
                        <span className="mt-0.5 flex items-center gap-1 text-[11.5px]">
                          {teacher.verified ? (
                            <ShieldCheck size={11} className="shrink-0 text-accent" aria-hidden />
                          ) : (
                            <User size={11} className="shrink-0 text-subtle" aria-hidden />
                          )}
                          <span className="text-muted">{teacher.professor}</span>
                          {/* Published by the instructor of record, versus
                              reported by students. Different claims, shown as
                              different claims. */}
                          <span className="text-subtle">
                            {teacher.verified
                              ? '· confirmed by the instructor'
                              : `· reported by ${teacher.reports} ${teacher.reports === 1 ? 'student' : 'students'}`}
                          </span>
                        </span>
                      )}
                    </span>

                    {/*
                      NO WATCH BUTTON ON A TERM THAT HAS ENDED. It is not a
                      styling choice: a watch is a standing job that re-checks
                      this class number until a seat frees, and on a finished
                      term it would poll a dead section forever and never fire.
                      An offer the product cannot honour does not belong on the
                      row at all.
                    */}
                    {over ? (
                      <span className="shrink-0 px-2.5 py-1.5 text-[12px] text-subtle">
                        Term over
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void watch(s)}
                        disabled={added === s.classNumber}
                        className={cn(
                          'shrink-0 rounded-lg px-2.5 py-1.5 text-[12px] font-medium transition-colors duration-150',
                          added === s.classNumber
                            ? 'text-success'
                            : 'bg-accent-soft text-accent hover:bg-accent hover:text-accent-contrast',
                        )}
                      >
                        {added === s.classNumber ? 'Watching' : isOpen ? 'Watch anyway' : 'Watch'}
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <p className="border-t border-border px-4 py-2.5 text-[11px] leading-snug text-subtle">
          Seat counts come from Concordia&rsquo;s published course data and are checked
          periodically: not continuously. Some sections hold seats for specific programs, so an
          open seat isn&rsquo;t always one you can take.
        </p>
      </div>
    </ModalShell>
  )
}

/** A compact native-free filter chip. Uses the app's Select so the dropdown
 * portals above the modal rather than clipping inside it. */
function FilterSelect({
  label,
  value,
  onChange,
  options,
  icon = false,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  icon?: boolean
}) {
  return (
    <span className="inline-flex items-center gap-1">
      {icon && <ArrowDownUp size={11} className="text-subtle" aria-hidden />}
      <Select
        ariaLabel={label}
        value={value}
        onChange={onChange}
        size="sm"
        tone="control"
        className="w-[124px]"
        options={options}
      />
    </span>
  )
}
