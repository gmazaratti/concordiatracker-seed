import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Bus,
  Check,
  Copy,
  Link2,
  Plus,
  Printer,
  Save,
  Trash2,
  X,
} from 'lucide-react'
import { Select } from '@/components/ui/Select'
import { useAppData } from '@/app/providers/app-data'
import { loadAcademicProfile, summarizeRecord } from '@/lib/academic-record'
import { normalizeCode } from '@/lib/prereq'
import { COURSE_COLORS } from '@/lib/course-color'
import { termLabel, type SectionOption } from '@/lib/seats'
import { weekdayNames } from '@/lib/date'
import {
  createSchedule,
  deleteSchedule,
  listSchedules,
  shareSchedule,
  updateSchedule,
  ENROLLMENT_STATES,
  type EnrollmentState,
  type PickedSection,
  type SavedSchedule,
  type TimeBlock,
} from '@/lib/schedules'
import { cn } from '@/lib/cn'
import {
  daysOff,
  findCampusGaps,
  findConflicts,
  placeSections,
  weeklyHours,
} from './schedule'
import { WeekGrid } from './WeekGrid'
import { ScheduleSearch } from './ScheduleSearch'
import { TimeBlocks } from './TimeBlocks'

/**
 * Build a week from real sections.
 *
 * Three panes, like Concordia's own: find on the left, what you have picked in
 * the middle, the week on the right. That shape is deliberate — students have
 * already learned it, and a planner that reads as unfamiliar gets abandoned
 * before it gets useful.
 *
 * What Concordia's does not do, and this does: start from the classes you are
 * already in, let you block out the times you are not available, tell you what
 * is wrong with the result, keep more than one draft, and hand you a link.
 */
export function ScheduleBuilder() {
  const { courses } = useAppData()
  const [picked, setPicked] = useState<PickedSection[]>([])
  const [blocks, setBlocks] = useState<TimeBlock[]>([])
  const [termCode, setTermCode] = useState('')
  const [terms, setTerms] = useState<string[]>([])
  const [saved, setSaved] = useState<SavedSchedule[]>([])
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [name, setName] = useState('My schedule')
  const [eligibleOnly, setEligibleOnly] = useState(false)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)

  const { pastCourses, assessments } = useAppData()
  const [trusted, setTrusted] = useState(false)
  useEffect(() => {
    let alive = true
    void loadAcademicProfile().then((p) => alive && setTrusted(p.recordComplete))
    void listSchedules().then((rows) => alive && setSaved(rows))
    return () => {
      alive = false
    }
  }, [])

  const record = useMemo(() => {
    const summary = summarizeRecord(pastCourses, assessments)
    return { completed: new Set(summary.completedCodes.map(normalizeCode)), credits: summary.credits }
  }, [pastCourses, assessments])

  /**
   * Seed from the classes you are already in.
   *
   * An empty builder is a blank page with a search box, and the most common
   * real task is not "plan from nothing" but "swap one class out of the term I
   * already have". Only courses with a readable meeting time are seeded, since
   * one without contributes nothing to a week grid.
   *
   * Adjusted during render rather than in an effect: an effect that sets state
   * on first data arrival renders twice and trips react-hooks/set-state-in-effect.
   * `seeded` is state, not a ref, so a re-render cannot seed a second time.
   */
  const [seeded, setSeeded] = useState(false)
  if (!seeded && currentId === null && picked.length === 0 && courses.length > 0) {
    setSeeded(true)
    const fromCurrentTerm: PickedSection[] = courses
      .filter((c) => c.code.trim() && c.meetingTimes.trim())
      .map((c) => ({
        code: c.code,
        section: {
          classNumber: `current-${c.id}`,
          termCode: '',
          section: c.section || '—',
          courseTitle: c.title,
          component: '',
          componentLabel: '',
          meetingTimes: c.meetingTimes,
          enrolled: null,
          capacity: null,
          waitlisted: null,
          waitlistCap: null,
          hasReserved: false,
          location: c.location.split(' ')[0] ?? '',
          instructionMode: '',
          building: '',
          room: c.location,
        } satisfies SectionOption,
      }))
    if (fromCurrentTerm.length > 0) setPicked(fromCurrentTerm)
  }

  const placed = useMemo(() => placeSections(picked), [picked])
  const conflicts = useMemo(() => findConflicts(placed), [placed])
  const gaps = useMemo(() => findCampusGaps(placed), [placed])
  const colourOf = useMemo(() => {
    const map = new Map<string, string>()
    let i = 0
    for (const p of picked) {
      if (!map.has(p.code)) map.set(p.code, COURSE_COLORS[i++ % COURSE_COLORS.length].hex)
    }
    return map
  }, [picked])

  const add = useCallback((code: string, section: SectionOption) => {
    setPicked((prev) =>
      prev.some((p) => p.section.classNumber === section.classNumber)
        ? prev
        : [...prev, { code, section }],
    )
  }, [])

  async function save() {
    if (currentId) {
      await updateSchedule(currentId, { name, termCode: termCode || null, sections: picked, blocks })
    } else {
      const id = await createSchedule({ name, termCode: termCode || null, sections: picked, blocks })
      setCurrentId(id)
    }
    setSaved(await listSchedules())
    setSavedFlash(true)
    window.setTimeout(() => setSavedFlash(false), 1800)
  }

  function open(s: SavedSchedule) {
    setCurrentId(s.id)
    setName(s.name)
    setTermCode(s.term_code ?? '')
    setPicked(s.sections ?? [])
    setBlocks(s.blocks ?? [])
    setShareUrl(s.share_token ? `${location.origin}/s/${s.share_token}` : null)
  }

  async function share() {
    if (!currentId) return
    const token = await shareSchedule(currentId)
    if (token) setShareUrl(`${location.origin}/s/${token}`)
  }

  return (
    <div>
      {/* ── Toolbar ──────────────────────────────────────────────────── */}
      {/* Two groups, not seven loose controls: what this schedule IS on the
          left, what you can DO with it on the right. Every action says what it
          does on hover, because "Save as new" and "Share" both have a
          consequence you cannot guess from three words. */}
      <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border pb-3 print:hidden">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label="Schedule name"
          className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1.5 font-display text-[16px] font-semibold text-fg hover:border-border focus:border-accent focus:bg-canvas focus:outline-none sm:max-w-64"
        />

        <div className="w-36">
          <Select
            value={termCode}
            onChange={setTermCode}
            ariaLabel="Term"
            placeholder="Any term"
            size="sm"
            options={[
              { value: '', label: 'Any term' },
              ...terms.map((c) => ({ value: c, label: termLabel(c) })),
            ]}
          />
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={eligibleOnly}
          disabled={!trusted}
          onClick={() => setEligibleOnly((v) => !v)}
          title={
            trusted
              ? 'Hide courses whose prerequisites you have not met'
              : 'Mark your record complete in My record to use this'
          }
          className="inline-flex items-center gap-2 text-[12.5px] text-muted transition-colors duration-150 hover:text-fg disabled:opacity-50"
        >
          <span
            className={cn(
              'grid size-4 shrink-0 place-items-center rounded-full border transition-colors duration-150',
              eligibleOnly ? 'border-accent bg-accent' : 'border-border-strong',
            )}
          >
            {eligibleOnly && <Check size={10} className="text-accent-contrast" aria-hidden />}
          </span>
          Only what I can take
        </button>

        <span className="ml-auto flex items-center gap-1.5">
          <ToolbarButton
            onClick={() => void save()}
            icon={savedFlash ? Check : Save}
            label={savedFlash ? 'Saved' : currentId ? 'Save' : 'Save as new'}
            hint={
              currentId
                ? 'Update this saved schedule'
                : 'Keep this as a saved draft you can come back to'
            }
            highlight={savedFlash}
          />
          <ToolbarButton
            onClick={() => window.print()}
            icon={Printer}
            label="Print"
            hint="Print or save the week as a PDF"
          />
          <ToolbarButton
            onClick={() => void share()}
            icon={Link2}
            label="Share"
            disabled={!currentId}
            hint={
              currentId
                ? 'Create a link anyone can open to view this timetable'
                : 'Save it first, then you can share a link'
            }
          />
        </span>
      </div>

      {shareUrl && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-accent/40 bg-accent-soft px-3 py-2 print:hidden">
          <code className="min-w-0 flex-1 truncate text-[12px] text-fg">{shareUrl}</code>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(shareUrl).then(() => {
                setCopied(true)
                window.setTimeout(() => setCopied(false), 1800)
              })
            }}
            className="inline-flex items-center gap-1 rounded border border-border bg-surface px-2 py-1 text-[11.5px] text-muted transition-colors duration-150 hover:text-fg"
          >
            {copied ? <Check size={11} aria-hidden /> : <Copy size={11} aria-hidden />}
            {copied ? 'Copied' : 'Copy'}
          </button>
          <span className="w-full text-[11px] text-subtle">
            Anyone with this link can view the timetable. It does not show who it belongs to, and
            they can save a copy as their own.
          </span>
        </div>
      )}

      {saved.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-1.5 print:hidden">
          <span className="text-[11px] font-semibold tracking-wide text-subtle uppercase">
            Saved
          </span>
          {saved.map((s) => (
            <span key={s.id} className="inline-flex items-center">
              <button
                type="button"
                onClick={() => open(s)}
                className={cn(
                  'rounded-l border py-1 pl-2 pr-1.5 text-[11.5px] transition-colors duration-150',
                  currentId === s.id
                    ? 'border-accent bg-accent-soft text-accent'
                    : 'border-border text-muted hover:text-fg',
                )}
              >
                {s.name}
                <span className="ml-1 text-subtle">{(s.sections ?? []).length}</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  void deleteSchedule(s.id).then(async () => {
                    setSaved(await listSchedules())
                    if (currentId === s.id) setCurrentId(null)
                  })
                }
                aria-label={`Delete ${s.name}`}
                className="rounded-r border border-l-0 border-border px-1 py-1 text-subtle transition-colors duration-150 hover:text-danger"
              >
                <X size={11} aria-hidden />
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={() => {
              setCurrentId(null)
              setName('New schedule')
              setPicked([])
            }}
            className="inline-flex items-center gap-1 rounded border border-dashed border-border px-2 py-1 text-[11.5px] text-subtle transition-colors duration-150 hover:border-accent hover:text-fg"
          >
            <Plus size={11} aria-hidden />
            New
          </button>
        </div>
      )}

      {/* ── Three panes ──────────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-[260px_210px_minmax(0,1fr)]">
        <div className="print:hidden">
          <ScheduleSearch
            blocks={blocks}
            termCode={termCode}
            onTermFound={setTerms}
            onAdd={add}
            taken={new Set(picked.map((p) => p.section.classNumber))}
            eligibleOnly={eligibleOnly}
            record={record}
          />
          <TimeBlocks blocks={blocks} onChange={setBlocks} />
        </div>

        <div className="min-w-0 print:hidden">
          <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-subtle uppercase">
            In this schedule
          </p>
          {picked.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-[12px] text-subtle">
              Nothing added yet.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {picked.map((p) => (
                <li
                  key={p.section.classNumber}
                  className="flex items-start gap-2 rounded-lg border border-border bg-surface px-2.5 py-2"
                >
                  <span
                    className="mt-1 size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: colourOf.get(p.code) }}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] font-medium text-fg">
                      {p.code} {p.section.section}
                      {p.section.component ? ` · ${p.section.component}` : ''}
                    </span>
                    <span className="block truncate text-[11px] text-subtle">
                      {p.section.meetingTimes ?? 'Time TBA'}
                    </span>
                    {p.section.classNumber.startsWith('current-') && (
                      <span className="block text-[10.5px] text-subtle">from your current term</span>
                    )}
                    <span className="mt-1 block">
                      <Select
                        value={p.state ?? 'planned'}
                        onChange={(next) =>
                          setPicked((prev) =>
                            prev.map((x) =>
                              x.section.classNumber === p.section.classNumber
                                ? { ...x, state: next as EnrollmentState }
                                : x,
                            ),
                          )
                        }
                        ariaLabel={`Status for ${p.code}`}
                        size="sm"
                        tone="control"
                        options={ENROLLMENT_STATES.map((e) => ({
                          value: e.value,
                          label: e.label,
                          dot: e.dot,
                        }))}
                      />
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setPicked((prev) =>
                        prev.filter((x) => x.section.classNumber !== p.section.classNumber),
                      )
                    }
                    aria-label={`Remove ${p.code}`}
                    className="grid size-6 shrink-0 place-items-center rounded text-subtle transition-colors duration-150 hover:text-danger"
                  >
                    <Trash2 size={11} aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="min-w-0">
          <h2 className="mb-1.5 hidden text-[14px] font-semibold text-fg print:block">{name}</h2>
          <WeekGrid placed={placed} blocks={blocks} colourOf={colourOf} conflicts={conflicts} />

          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-subtle">
            <span>{weeklyHours(placed)} hours a week</span>
            {daysOff(placed).length > 0 && (
              <span>Free: {daysOff(placed).map((d) => weekdayNames()[d]).join(', ')}</span>
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
                    {g.minutes} minutes from {g.from.code} ({g.from.section.location}) to{' '}
                    {g.to.code} ({g.to.section.location}) on {weekdayNames()[g.day]}. The shuttle
                    takes about 30 minutes before waiting.
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="mt-3 text-[11px] text-subtle">
            A plan, not a registration. Seat counts were read when each section was added and can
            change; register in the Student Centre.
          </p>
        </div>
      </div>
    </div>
  )
}

/** One toolbar action. Same shape for every one of them, and every one says
 *  what it does on hover rather than relying on a three-word label. */
function ToolbarButton({
  onClick,
  icon: Icon,
  label,
  hint,
  disabled,
  highlight,
}: {
  onClick: () => void
  icon: typeof Save
  label: string
  hint: string
  disabled?: boolean
  highlight?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={hint}
      aria-label={`${label}. ${hint}`}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12.5px] font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50',
        highlight
          ? 'border-success/50 bg-success/10 text-success'
          : 'border-border text-muted hover:border-accent hover:text-fg',
      )}
    >
      <Icon size={13} aria-hidden />
      {label}
    </button>
  )
}
