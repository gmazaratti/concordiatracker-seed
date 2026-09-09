import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  Bus,
  CalendarRange,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Eye,
  EyeOff,
  Lightbulb,
  Link2,
  MessageSquare,
  Plus,
  Printer,
  Save,
  Trash2,
  TriangleAlert,
  X,
} from 'lucide-react'
import { Select } from '@/components/ui/Select'
import { useAppData } from '@/app/providers/app-data'
import { loadAcademicProfile, summarizeRecord } from '@/lib/academic-record'
import { normalizeCode } from '@/lib/prereq'
import { COURSE_COLORS } from '@/lib/course-color'
import type { SectionOption } from '@/lib/seats'
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
  type Placed,
} from './schedule'
import { parseCourseCode, termCodeFor } from '@/lib/course-sections'
import { WeekGrid } from './WeekGrid'
import { ScheduleSearch } from './ScheduleSearch'
import { SuggestedCourses } from './SuggestedCourses'
import { ScheduleGenerator } from './ScheduleGenerator'
import type { GeneratedSchedule } from '@/lib/schedule-generate'
import { ModalShell } from '@/command/ModalShell'
import { Checkbox } from '@/components/ui/Checkbox'
import { Pin, PinOff } from 'lucide-react'
import { useProgramForUser } from './useProgramForUser'
import { findSections, termLabel } from '@/lib/seats'
import { ScheduleFilters } from './ScheduleFilters'
import { ScheduleBlockMenu, type BlockMenuTarget } from './ScheduleBlockMenu'
import { SectionDetails } from './SectionDetails'
import { seatSummary } from './seat-summary'
import { UnscheduledStrip } from './UnscheduledStrip'
import { ScheduleTips } from './ScheduleTips'
import { currentTermName, laterTerms } from './past-terms'
import { SavedCoursesButton } from './SavedCoursesPicker'

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
  /**
   * The term being planned, seeded from the calendar.
   *
   * It used to start empty and only gain a value once a search happened to
   * return sections — so the picker was gated on `terms.length > 0` and simply
   * never appeared on a page nobody had searched on yet. The term you are in is
   * knowable without asking Concordia anything, so it is the default, and the
   * control is always there.
   */
  const [termCode, setTermCode] = useState(() => termCodeFor(currentTermName()) ?? '')
  /** Terms Concordia actually returned sections for, merged into the list below. */
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

  const program = useProgramForUser()
  // Clicking a suggestion fills the search box rather than adding the course
  // outright: which SECTION you want is still yours to pick, and we have no
  // business choosing a in-person 8am for someone.
  const [seedQuery, setSeedQuery] = useState('')

  /**
   * Courses whose slot must not move when regenerating.
   *
   * Keyed by course CODE rather than class number: pinning is a statement
   * about the course ("I have this one settled"), and the section it names is
   * the one currently on the grid. Local rather than saved, because a pin is
   * scaffolding for building a draft, not a property of the finished thing.
   */
  const [pins, setPins] = useState<Set<string>>(new Set())

  // The classes already on your record, drawn on the week so a draft is built
  // around real commitments rather than against an empty grid. Toggleable,
  // because "what if I dropped everything" is also a question worth asking.
  const [showCurrent, setShowCurrent] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [tips, setTips] = useState(false)

  /**
   * Classes kept in the schedule but taken off the grid.
   *
   * Keyed by class number, because this is about one SECTION rather than the
   * course — the whole use is holding a Tuesday-morning option out of the way
   * while you try the Thursday one in the same hour. Deleting and re-adding
   * loses the seat counts and the pin, which is why it was worth its own idea.
   */
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  /** The right-click menu on the week, and the card it can open. */
  const [menu, setMenu] = useState<BlockMenuTarget | null>(null)
  const [details, setDetails] = useState<PickedSection | null>(null)

  /**
   * Generated drafts, drawn on the real week.
   *
   * Cycling used to happen inside the Generate dialog against a list of codes
   * and times — the one view in which you cannot see what a timetable is like.
   * The question being asked is "what does my week become", so the answer is
   * shown on the week, and the arrows sit above it.
   */
  const [drafts, setDrafts] = useState<{
    results: GeneratedSchedule[]
    index: number
    again: () => void
  } | null>(null)

  /**
   * The course being hovered in the suggestions list, drawn on the week as a
   * dashed outline.
   *
   * Fetched on hover and cached, because the useful question is not "what is
   * this course" but "where would it land" — and answering that needs its real
   * meeting times. Cached because moving down a list of eight would otherwise
   * be eight round trips, and re-entering a row a ninth.
   */
  const [ghostCode, setGhostCode] = useState<string | null>(null)
  const [ghostCache, setGhostCache] = useState<Map<string, Placed[]>>(new Map())

  // DERIVED, not stored. The effect only ever fetches — writing the visible
  // ghost from inside it would be a setState during render, and the empty case
  // needs no state at all.
  const ghost = ghostCode ? (ghostCache.get(ghostCode) ?? []) : []

  useEffect(() => {
    if (!ghostCode || ghostCache.has(ghostCode)) return
    const parsed = parseCourseCode(ghostCode)
    if (!parsed) return
    let alive = true
    void findSections(parsed.subject, parsed.catalog)
      .then((rows) => {
        if (!alive) return
        // One section per component, from the term being planned. A preview
        // drawing all fourteen lectures of a course is not a preview.
        const inTerm = rows.filter((r) => r.termCode === termCode && r.meetingTimes)
        const firstPer = new Map<string, (typeof rows)[number]>()
        for (const r of inTerm) if (!firstPer.has(r.component)) firstPer.set(r.component, r)
        const drawn = placeSections(
          [...firstPer.values()].map((section) => ({ code: ghostCode, section })),
        )
        setGhostCache((prev) => new Map(prev).set(ghostCode, drawn))
      })
      .catch(() => {
        // A course we cannot look up simply draws nothing. Cached as empty so
        // re-entering the row does not retry on every mouse move.
        if (alive) setGhostCache((prev) => new Map(prev).set(ghostCode, []))
      })
    return () => {
      alive = false
    }
  }, [ghostCode, termCode, ghostCache])

  const record = useMemo(() => {
    const summary = summarizeRecord(pastCourses, assessments)
    return {
      completed: new Set(summary.completedCodes.map(normalizeCode)),
      credits: summary.credits,
      // The classes you are IN. Without these, a student taking COMM 215 right
      // now was told they do not meet COMM 225 — which the university plainly
      // disagrees with, since it let them register for both.
      inProgress: new Set(courses.filter((c) => c.code.trim()).map((c) => normalizeCode(c.code))),
    }
  }, [pastCourses, assessments, courses])

  /**
   * What the generator must keep, in the shape it wants.
   *
   * Derived from the pins and what is currently on the grid rather than stored
   * separately, so a pin can never point at a section that has since been
   * removed.
   */
  const pinnedForGenerator = useMemo(
    () =>
      [...pins]
        .map((code) => ({
          code,
          sections: picked.filter((p) => p.code === code).map((p) => p.section),
        }))
        .filter((p) => p.sections.length > 0),
    [pins, picked],
  )

  /**
   * What the generator can build ON TOP of, with the credit value the calendar
   * gave each course.
   *
   * Falls back to 3 only when the course is not one of yours — a searched
   * section carries no credit value of its own, and 3 is the commonest.
   */
  const existingForGenerator = useMemo(() => {
    const byCode = new Map<string, { code: string; sections: SectionOption[]; credits: number }>()
    for (const p of picked) {
      const cur = byCode.get(p.code)
      if (cur) cur.sections.push(p.section)
      else {
        const mine = courses.find((c) => c.code === p.code)
        byCode.set(p.code, { code: p.code, sections: [p.section], credits: mine?.credits ?? 3 })
      }
    }
    return [...byCode.values()]
  }, [picked, courses])

  /**
   * Take a generated draft.
   *
   * Replaces everything EXCEPT the pins, which are already in the draft by
   * construction — a "use this one" that quietly dropped a pinned class would
   * make pinning meaningless. Enrolment state carries over by class number, so
   * a class you are actually registered in does not come back as a plan.
   */
  const applyGenerated = useCallback(
    (result: { code: string; sections: SectionOption[] }[]) => {
      setPicked((prev) => {
        const was = new Map(prev.map((p) => [p.section.classNumber, p.state]))
        return result.flatMap((r) =>
          r.sections.map((section) => ({
            code: r.code,
            section,
            state: was.get(section.classNumber),
          })),
        )
      })
    },
    [],
  )

  // Passed, plus already on this schedule. Suggesting either back is noise.
  const taken = useMemo(
    () => [...record.completed, ...picked.map((p) => p.code)],
    [record, picked],
  )

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
    // A class with no meeting time is still a class you are taking. Filtering
    // them out here is why an online course vanished from the builder
    // altogether; it belongs on the schedule, under the grid, in the strip that
    // exists precisely for classes the week has nowhere to draw.
    const fromCurrentTerm: PickedSection[] = courses
      .filter((c) => c.code.trim())
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
          instructionMode: c.delivery ?? '',
          building: '',
          room: c.location,
        } satisfies SectionOption,
        // The word is already true and it is what makes them separable from
        // sections added while planning, which the "show my classes" toggle
        // needs.
        state: 'enrolled' as EnrollmentState,
      }))
    if (fromCurrentTerm.length > 0) setPicked(fromCurrentTerm)
  }

  /**
   * The terms worth offering: this one and the ones ahead of it, plus anything
   * Concordia actually published sections for.
   *
   * Derived rather than discovered, so the control exists before any network
   * call does. The union matters both ways — a student planning next Fall needs
   * a term the search has never mentioned, and a term the search DID return has
   * real sections in it whether or not our calendar arithmetic listed it.
   */
  const termOptions = useMemo(() => {
    const known = [currentTermName(), ...laterTerms(4)]
      .map(termCodeFor)
      .filter((c): c is string => !!c)
    return [...new Set([...known, ...terms])].sort()
  }, [terms])

  // Hiding your current classes answers "what would a clean term look like"
  // without throwing them away — they come straight back. The eye does the same
  // for one section at a time.
  const visiblePicked = useMemo(
    () =>
      picked
        .filter((p) => showCurrent || p.state !== 'enrolled')
        .filter((p) => !hidden.has(p.section.classNumber)),
    [picked, showCurrent, hidden],
  )
  /** What the week is actually showing: your schedule, or the draft on top. */
  const draft = drafts?.results[drafts.index] ?? null
  const draftPicked = useMemo<PickedSection[]>(
    () =>
      draft
        ? draft.picks.flatMap((p) => p.sections.map((section) => ({ code: p.code, section })))
        : [],
    [draft],
  )
  const placed = useMemo(
    () => placeSections(draft ? draftPicked : visiblePicked),
    [draft, draftPicked, visiblePicked],
  )
  const conflicts = useMemo(() => findConflicts(placed), [placed])
  const gaps = useMemo(() => findCampusGaps(placed), [placed])
  const colourOf = useMemo(() => {
    const map = new Map<string, string>()
    let i = 0
    for (const p of [...picked, ...draftPicked]) {
      if (!map.has(p.code)) map.set(p.code, COURSE_COLORS[i++ % COURSE_COLORS.length].hex)
    }
    return map
  }, [picked, draftPicked])

  const togglePin = useCallback((code: string) => {
    setPins((prev) => {
      const next = new Set(prev)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      return next
    })
  }, [])

  const toggleHidden = useCallback((classNumber: string) => {
    setHidden((prev) => {
      const next = new Set(prev)
      if (next.has(classNumber)) next.delete(classNumber)
      else next.add(classNumber)
      return next
    })
  }, [])

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
      {/* Three things: what this schedule is called, what is being filtered
          out, and what you can do with it. Term, eligibility and blocked time
          used to be three controls in three shapes in three places; they do one
          job between them, so they are one button now. */}
      <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-border pb-3 print:hidden">
        {/* Labelled rather than left to be inferred. An unlabelled text box in
            a toolbar reads as a search field, which is what it was being taken
            for — and the schedule's name is the one thing on this page that is
            purely yours. */}
        <span className="flex min-w-0 flex-1 items-center gap-1.5 sm:flex-none">
          <span className="shrink-0 text-[11.5px] text-subtle">Title:</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-label="Schedule name"
            className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1.5 font-display text-[16px] font-semibold text-fg hover:border-border focus:border-accent focus:bg-canvas focus:outline-none sm:w-52"
          />
        </span>

        {/* Which term this whole page is about belongs beside its name, not
            buried in Filters with the things that hide rows. It is the first
            decision, and everything else — search, generate, the week itself —
            is scoped by it. The chevron turns to point up while the list is
            open, so the control says whether it is expecting an answer. */}
        <span className="flex shrink-0 items-center gap-1.5">
          <span className="text-[11.5px] text-subtle">Term:</span>
          <span className="w-36">
            <Select
              value={termCode}
              onChange={setTermCode}
              ariaLabel="Term"
              size="sm"
              options={termOptions.map((code) => ({ value: code, label: termLabel(code) }))}
            />
          </span>
        </span>

        <span className="ml-auto flex items-center gap-1.5">
          {/* The one action on this page that MAKES something, so it is the one
              that is filled rather than outlined. It opens a dialog because its
              inputs are a short form, and a form living permanently in the left
              rail is a form you scroll past.

              A calendar rather than a star: the star said "AI did this", and
              nothing here is a guess — it is a search over real sections with
              a stated rule for ranking them. */}
          <button
            type="button"
            onClick={() => setGenerating(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-[13px] font-medium text-accent-contrast transition-colors duration-150 hover:bg-accent-hover"
            title="Build a timetable around what you still need and the times you have blocked"
          >
            <CalendarRange size={14} aria-hidden />
            Generate
          </button>
          <ToolbarButton
            onClick={() => setTips(true)}
            icon={Lightbulb}
            label="Tips"
            hint="How blocking, pinning, hiding and generating work"
          />
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
            hint="Print the week, or save it as a PDF"
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

      {generating && (
        <ModalShell
          label="Generate a schedule"
          onClose={() => setGenerating(false)}
          widthClass="sm:max-w-md"
        >
          <div className="p-4 sm:p-5">
            <h2 className="font-display text-[17px] font-medium text-fg">Generate a schedule</h2>
            <p className="mt-1 text-[12.5px] leading-relaxed text-subtle">
              Around what you have pinned and the times you have blocked out. Nothing is registered.
            </p>
            <div className="mt-4">
              <ScheduleGenerator
                program={program}
                termCode={termCode}
                blocks={blocks}
                taken={taken}
                pinned={pinnedForGenerator}
                eligibleOnly={eligibleOnly}
                record={record}
                existing={existingForGenerator}
                onResults={(results, again) => {
                  setDrafts({ results, index: 0, again })
                  // Out of the way immediately: a full-screen dialog is the one
                  // thing you cannot read a timetable through.
                  setGenerating(false)
                }}
              />
            </div>
          </div>
        </ModalShell>
      )}

      {tips && <ScheduleTips onClose={() => setTips(false)} />}

      {details && (
        <SectionDetails
          code={details.code}
          section={details.section}
          onClose={() => setDetails(null)}
        />
      )}

      {menu && (
        <ScheduleBlockMenu
          target={menu}
          pinned={pins.has(menu.code)}
          hidden={hidden.has(menu.classNumber)}
          onPin={() => togglePin(menu.code)}
          onHide={() => toggleHidden(menu.classNumber)}
          onRemove={() =>
            setPicked((prev) => prev.filter((x) => x.section.classNumber !== menu.classNumber))
          }
          onDetails={() => {
            const found = picked.find((p) => p.section.classNumber === menu.classNumber)
            if (found) setDetails(found)
          }}
          onClose={() => setMenu(null)}
        />
      )}

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
          {/* The link is for people outside the app. This is for people in it,
              and it sends the week as a card they can look at and save rather
              than a URL they have to open. */}
          <Link
            to="/app/community?c=messages"
            className="inline-flex items-center gap-1.5 rounded border border-accent/40 px-2 py-1 text-[11.5px] text-accent transition-colors duration-150 hover:bg-accent/10"
          >
            <MessageSquare size={11} aria-hidden />
            Send to a friend
          </Link>
          <span className="w-full text-[11px] text-subtle">
            Anyone with this link can view the timetable. It does not show who it belongs to, and
            they can save a copy as their own. Sending it to a friend attaches the week itself —
            they can save it as an image.
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
      {/* Each one a card with its own heading. Previously they were three
          columns of loose content with nothing between them, so the eye could
          not tell where finding ended and choosing began. */}
      {/* Find · picked · week, left to right — the same three-column reading
          order Concordia's own builder uses, and the order of the task: look
          something up, see what you have chosen, see what it does to your week.
          Picked used to sit UNDER find in a single rail, which meant the list
          you check while adding was the thing scrolled off the bottom. */}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-[248px_248px_minmax(0,1fr)] lg:items-stretch">
        <Pane
          title="Find a course"
          scroll
          className="print:hidden"
          action={
            <span className="flex items-center gap-1.5">
              <SavedCoursesButton onPick={setSeedQuery} />
              <ScheduleFilters
                eligibleOnly={eligibleOnly}
                onEligibleChange={setEligibleOnly}
                eligibleAvailable={trusted}
                blocks={blocks}
                onBlocksChange={setBlocks}
              />
            </span>
          }
        >
          <ScheduleSearch
            key={seedQuery}
            initialQuery={seedQuery}
            blocks={blocks}
            termCode={termCode}
            onTermFound={setTerms}
            onAdd={add}
            taken={new Set(picked.map((p) => p.section.classNumber))}
            eligibleOnly={eligibleOnly}
            record={record}
          />
          {/* Only when the search is empty — see the note in SuggestedCourses.
              The moment someone types, they know what they want. */}
          <SuggestedCourses
            program={program}
            taken={taken}
            onPick={setSeedQuery}
            onHover={setGhostCode}
          />
        </Pane>

        <Pane
          title="In this schedule"
          count={picked.length}
          scroll
          className="print:hidden"
          action={
            picked.some((p) => p.state === 'enrolled') ? (
              <span
                title="The classes you are already registered in. Hiding them lets you try a different term on the grid without removing anything — nothing here changes your Courses tab either way."
                className="flex items-center"
              >
                <Checkbox
                  checked={showCurrent}
                  onChange={setShowCurrent}
                  label={
                    <span className="text-[11.5px] whitespace-nowrap text-subtle">
                      Show current
                    </span>
                  }
                />
              </span>
            ) : undefined
          }
        >
          {picked.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-[12px] text-subtle">
              Nothing added yet.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {picked.map((p) => {
                const seats = seatSummary(p.section)
                const isHidden = hidden.has(p.section.classNumber)
                return (
                <li
                  key={p.section.classNumber}
                  className={cn(
                    'flex items-start gap-2 rounded-lg border border-border bg-canvas px-2.5 py-2',
                    isHidden && 'opacity-60',
                  )}
                >
                  <span
                    className="mt-1 size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: colourOf.get(p.code) }}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    {/* The whole block opens the full card. Everything Concordia
                        publishes about a section does not fit in a 248px column,
                        and the parts that do not fit — the class number you
                        register with, the reserved-seat caveat — are the parts
                        that matter most when you act on it. */}
                    <button
                      type="button"
                      onClick={() => setDetails(p)}
                      title="Room, campus, seats and class number"
                      className="block w-full text-left"
                    >
                      <span className="block truncate text-[12.5px] font-medium text-fg">
                        {p.code} {p.section.section}
                        {p.section.component ? ` · ${p.section.component}` : ''}
                      </span>
                      <span className="block truncate text-[11px] text-subtle">
                        {p.section.meetingTimes || 'No scheduled time'}
                      </span>
                      <span className="block truncate text-[11px] text-subtle">
                        {whereLine(p.section)}
                      </span>
                      {/* Seats, read when this section was added. The card
                          carries the caveat that goes with that. */}
                      {seats && (
                        <span
                          className={cn(
                            'mt-0.5 block truncate text-[11px]',
                            seats.open > 0 ? 'text-success' : 'text-warning',
                          )}
                        >
                          {seats.headline}
                        </span>
                      )}
                    </button>
                    {isHidden && (
                      <span className="mt-0.5 block text-[11px] text-subtle">
                        Hidden from the week
                      </span>
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
                  <span className="flex shrink-0 flex-col gap-1">
                    {/* Pinned courses survive every regeneration in the exact
                        slot shown here — the point of a pin is that the one
                        thing you have settled stops being reshuffled. */}
                    <button
                      type="button"
                      onClick={() => togglePin(p.code)}
                      aria-pressed={pins.has(p.code)}
                      aria-label={pins.has(p.code) ? `Unpin ${p.code}` : `Pin ${p.code}`}
                      title={
                        pins.has(p.code)
                          ? 'Pinned — this one will not move'
                          : 'Pin so it stays put when you regenerate'
                      }
                      className={cn(
                        'grid size-6 place-items-center rounded transition-colors duration-150',
                        pins.has(p.code)
                          ? 'bg-accent-soft text-accent'
                          : 'text-subtle hover:text-fg',
                      )}
                    >
                      {pins.has(p.code) ? <Pin size={11} aria-hidden /> : <PinOff size={11} aria-hidden />}
                    </button>
                    {/* Off the grid, still in the schedule. The way to try the
                        Thursday section in the same hour as the Tuesday one
                        without deleting either. */}
                    <button
                      type="button"
                      onClick={() => toggleHidden(p.section.classNumber)}
                      aria-pressed={isHidden}
                      aria-label={
                        isHidden ? `Show ${p.code} on the week` : `Hide ${p.code} from the week`
                      }
                      title={
                        isHidden
                          ? 'Hidden from the week — click to put it back'
                          : 'Take it off the week without removing it'
                      }
                      className={cn(
                        'grid size-6 place-items-center rounded transition-colors duration-150',
                        isHidden ? 'bg-accent-soft text-accent' : 'text-subtle hover:text-fg',
                      )}
                    >
                      {isHidden ? <EyeOff size={11} aria-hidden /> : <Eye size={11} aria-hidden />}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setPicked((prev) =>
                          prev.filter((x) => x.section.classNumber !== p.section.classNumber),
                        )
                      }
                      aria-label={`Remove ${p.code}`}
                      className="grid size-6 place-items-center rounded text-subtle transition-colors duration-150 hover:text-danger"
                    >
                      <Trash2 size={11} aria-hidden />
                    </button>
                  </span>
                </li>
                )
              })}
            </ul>
          )}
        </Pane>

        <div className="min-w-0 md:col-span-2 lg:col-span-1">
          {/* Print header. Hidden on screen, because on screen the name is
              already in the toolbar; on paper there is no toolbar and a sheet
              on a fridge should say what it is and where it came from. */}
          <div className="mb-3 hidden items-end justify-between border-b border-border pb-2 print:flex">
            <div>
              <p className="text-[11px] font-semibold tracking-[0.16em] text-subtle uppercase">
                ConcordiaTracker
              </p>
              <h2 className="font-display text-[20px] font-semibold text-fg">{name}</h2>
            </div>
            <p className="text-[11px] text-subtle">
              {picked.length} class{picked.length === 1 ? '' : 'es'} · {weeklyHours(placed)} hours a
              week
            </p>
          </div>
          {/* ── The draft bar ─────────────────────────────────────────
              Directly above the week it is describing, because the week IS the
              thing being cycled. Nothing has changed in your schedule until
              "Use this one" — the grid is showing a proposal. */}
          {drafts && draft && (
            <div className="mb-2 flex flex-wrap items-center gap-2 rounded-xl border border-accent/40 bg-accent-soft px-2.5 py-2 print:hidden">
              <span className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() =>
                    setDrafts((d) =>
                      d ? { ...d, index: (d.index - 1 + d.results.length) % d.results.length } : d,
                    )
                  }
                  disabled={drafts.results.length < 2}
                  aria-label="Previous option"
                  className="grid size-7 place-items-center rounded-lg border border-accent/40 text-accent transition-colors duration-150 hover:bg-accent/10 disabled:opacity-40"
                >
                  <ChevronLeft size={15} aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setDrafts((d) => (d ? { ...d, index: (d.index + 1) % d.results.length } : d))
                  }
                  disabled={drafts.results.length < 2}
                  aria-label="Next option"
                  className="grid size-7 place-items-center rounded-lg border border-accent/40 text-accent transition-colors duration-150 hover:bg-accent/10 disabled:opacity-40"
                >
                  <ChevronRight size={15} aria-hidden />
                </button>
              </span>

              <span className="min-w-0 flex-1 text-[12.5px] text-fg">
                <span className="font-medium">
                  Option {drafts.index + 1} of {drafts.results.length}
                </span>
                <span className="ml-1.5 text-subtle">
                  {draft.credits} cr
                  {draft.daysOff.length > 0 &&
                    ` · ${draft.daysOff.length} day${draft.daysOff.length === 1 ? '' : 's'} off`}
                  {' · preview only'}
                </span>
              </span>

              <span className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    applyGenerated(
                      draft.picks.map((p) => ({ code: p.code, sections: p.sections })),
                    )
                    setDrafts(null)
                  }}
                  className="rounded-lg bg-accent px-3 py-1.5 text-[12.5px] font-medium text-accent-contrast transition-colors duration-150 hover:bg-accent-hover"
                >
                  Use this one
                </button>
                <button
                  type="button"
                  onClick={() => drafts.again()}
                  className="rounded-lg border border-accent/40 px-2.5 py-1.5 text-[12.5px] text-accent transition-colors duration-150 hover:bg-accent/10"
                >
                  More
                </button>
                <button
                  type="button"
                  onClick={() => setDrafts(null)}
                  aria-label="Discard these drafts"
                  className="grid size-7 place-items-center rounded-lg border border-accent/40 text-accent transition-colors duration-150 hover:bg-accent/10"
                >
                  <X size={14} aria-hidden />
                </button>
              </span>

              {draft.warnings.length > 0 && (
                <ul className="w-full space-y-0.5 border-t border-accent/25 pt-1.5">
                  {draft.warnings.map((w, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-1.5 text-[11.5px] leading-relaxed text-warning"
                    >
                      <TriangleAlert size={12} className="mt-0.5 shrink-0" aria-hidden />
                      {w.text}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <WeekGrid
            placed={placed}
            ghost={ghost}
            blocks={blocks}
            colourOf={colourOf}
            conflicts={conflicts}
            onBlock={(day, start, end) =>
              setBlocks((prev) => [
                ...prev,
                { id: `b${Date.now()}-${prev.length}`, day, start, end, label: 'Busy' },
              ])
            }
            onRemoveBlock={(id) => setBlocks((prev) => prev.filter((b) => b.id !== id))}
            onSectionContext={(p, at) =>
              setMenu({ code: p.code, classNumber: p.section.classNumber, at })
            }
          />

          {/* A class with no slot is invisible on a week grid, and a student
              counting rectangles concludes they are taking one fewer class than
              they are. */}
          <UnscheduledStrip picked={draft ? draftPicked : visiblePicked} colourOf={colourOf} />

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

          {/* On paper the middle pane is gone, so the classes are listed here
              instead: a timetable grid without room numbers is half a sheet. */}
          {picked.length > 0 && (
            <ul className="mt-3 hidden grid-cols-2 gap-x-6 gap-y-1 print:grid">
              {picked.map((p) => (
                <li key={p.section.classNumber} className="flex items-baseline gap-2 text-[11px]">
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: colourOf.get(p.code) }}
                    aria-hidden
                  />
                  <span className="font-medium text-fg">
                    {p.code} {p.section.section}
                  </span>
                  <span className="text-subtle">
                    {p.section.meetingTimes ?? 'Time TBA'}
                    {p.section.building ? ` · ${p.section.building}${p.section.room}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <p className="mt-3 text-[11px] text-subtle print:mt-4">
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

/** One column of the builder. Titled and bounded, so the three read as three. */
function Pane({
  title,
  count,
  className,
  action,
  scroll,
  children,
}: {
  title: string
  count?: number
  className?: string
  /** A control that belongs to THIS pane, not to the schedule as a whole. */
  action?: React.ReactNode
  /**
   * Fill the row and scroll inside.
   *
   * The three columns used to be their own natural heights, so they ended at
   * three different places down the page and the row read as ragged. Filling
   * the row makes them level; the body scrolls so a long list of sections
   * cannot make the page taller than the week beside it.
   */
  scroll?: boolean
  children: React.ReactNode
}) {
  return (
    <section
      className={cn(
        'min-w-0 rounded-xl border border-border bg-surface p-3',
        scroll && 'flex flex-col lg:max-h-[calc(100svh-11rem)]',
        className,
      )}
    >
      <div className="mb-2 flex shrink-0 items-center gap-1.5">
        <h2 className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-subtle uppercase">
          {title}
          {count !== undefined && count > 0 && (
            <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10.5px] font-medium text-subtle">
              {count}
            </span>
          )}
        </h2>
        {action && <span className="ml-auto">{action}</span>}
      </div>
      {scroll ? <div className="min-h-0 flex-1 overflow-y-auto pr-0.5">{children}</div> : children}
    </section>
  )
}

/**
 * Where a section actually is, in one line.
 *
 * Concordia fills these fields inconsistently and our own seeded rows from a
 * student's registered courses fill them differently again — `building` is
 * empty and the whole thing sits in `room`. The old line tested `building`
 * alone, so every class you were actually enrolled in showed no location at
 * all, which is the one place a location is certain to be known.
 *
 * Falls through what we have to the most specific thing available, and says
 * "Room not published" rather than printing an empty line that reads as a
 * loading state.
 */
function whereLine(s: SectionOption): string {
  const campus = /LOY/i.test(s.location) ? 'Loyola' : /SGW/i.test(s.location) ? 'SGW' : ''
  const mode = /online|en ligne|remote/i.test(`${s.instructionMode} ${s.location}`) ? 'Online' : ''
  const room = s.building ? `${s.building} ${s.room}`.trim() : s.room.trim()
  const parts = [room, campus || mode].filter(Boolean)
  return parts.length > 0 ? parts.join(' · ') : 'Room not published'
}
