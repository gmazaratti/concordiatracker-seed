import { useEffect, useMemo, useState } from 'react'
import { ArrowDownUp, Loader2, MapPin, Search, ShieldCheck, User } from 'lucide-react'
import { ModalShell } from '@/command/ModalShell'
import { Select } from '@/components/ui/Select'
import { cn } from '@/lib/cn'
import { sectionInstructors, type SectionInstructor } from '@/lib/academic-record'
import {
  addWatch,
  findSections,
  termLabel,
  type SectionOption,
} from '@/lib/seats'

/**
 * Find a section and watch it.
 *
 * Sections are shown with their live seat counts, which does two jobs: it tells
 * you whether watching is even necessary, and it proves the numbers are real
 * before you rely on an alert built from them.
 */
export function SeatWatchModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [subject, setSubject] = useState('')
  const [catalog, setCatalog] = useState('')
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
  const [term, setTerm] = useState('all')
  const [campus, setCampus] = useState('all')
  const [day, setDay] = useState('all')
  const [openOnly, setOpenOnly] = useState(false)
  const [sort, setSort] = useState<'default' | 'fewest' | 'most'>('default')

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
      setSections(await findSections(subject, catalog))
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
      <div className="flex h-[min(78vh,620px)] flex-col">
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
                  ...terms.map((t) => ({ value: t, label: termLabel(t) })),
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
                return (
                  <li key={`${s.termCode}-${s.classNumber}`} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-x-2 text-[13px]">
                        <span className="font-medium text-fg">
                          {s.section} · {s.component}
                        </span>
                        <span className="text-[11.5px] text-subtle">{termLabel(s.termCode)}</span>
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
