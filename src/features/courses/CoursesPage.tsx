import { Link, useSearchParams } from 'react-router-dom'
import { useMemo, useState } from 'react'
import { useShownGpa } from '@/app/hooks/useShownGpa'
import { LayoutGrid, Plus, Rows3 } from 'lucide-react'
import { useAppData } from '@/app/providers/app-data'
import type { CoursesView } from '@/app/providers/app-data'
import { term } from '@/data/mock'
import { currentTermName, isFinishedTerm, isUpcomingTerm } from '@/features/planner/past-terms'
import { coursePercent, currentGpa } from '@/lib/gpa'
import { summarizeRecord } from '@/lib/record-summary'
import { looksFinished } from '@/lib/leftover-course'
import { isOpen } from '@/lib/status'
import { byDue, daysUntil } from '@/lib/date'
import { useT } from '@/i18n/i18n'
import { cn } from '@/lib/cn'
import { useCourseOrder } from './useCourseOrder'
import { CourseCard } from './CourseCard'
import { CourseGridCard } from './CourseGridCard'
import { CoursesHero } from './CoursesHero'
import { CoursesRail } from './CoursesRail'
import { PaywallCallout } from './Paywall'
import { MoodleClassNudge, MoodleConnectCard } from './MoodleClassNudge'
import { MoodleGridCard, MoodleListRow } from '@/features/moodle/MoodleCourseCard'
import { AddCourseChooser } from './AddCourseChooser'
import { TranscriptView } from './TranscriptView'
import { UnfiledPastCourses } from './UnfiledPastCourses'
import { AddForTerm, UpcomingCourses } from './UpcomingTerms'

/** Courses — the grade hub. The class list switches between a dense List (rows)
 * and a Google-Classroom Grid (colored cards); the choice sticks across SPA nav.
 * A term-standing rail sits alongside, in the same two-column language as Today. */
export function CoursesPage({
  detailBase = '/app/courses',
}: {
  /** Where a class opens. The preview route passes the preview detail page. */
  detailBase?: string
} = {}) {
  const preview = detailBase !== '/app/courses'
  const t = useT()
  const { plan, courses, pastCourses, assessments, coursesView, setCoursesView } = useAppData()
  const [chooserOpen, setChooserOpen] = useState(false)
  // `?tab=past` opens straight on a tab (the discovery nudges link here).
  // Followed when the address changes, never fought once the student clicks.
  const [params] = useSearchParams()
  const urlTab = params.get('tab')
  const fromUrl = urlTab === 'past' || urlTab === 'upcoming' ? urlTab : null
  const [tab, setTab] = useState<'current' | 'upcoming' | 'past'>(fromUrl ?? 'current')
  const [seenUrlTab, setSeenUrlTab] = useState(fromUrl)
  if (fromUrl !== seenUrlTab) {
    setSeenUrlTab(fromUrl)
    if (fromUrl) setTab(fromUrl)
  }
  const showPast = tab === 'past'
  const { sort: sortByOrder, move: moveCourse } = useCourseOrder()
  /** The card being dragged, and the one it is currently over. */
  const [dragId, setDragId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)

  /**
   * Courses split into the term you are running and terms you are about to.
   *
   * A course entered for next term is not archived - it has not happened yet -
   * so without this it sat in "This term" alongside the classes you are
   * actually attending, with nothing to tell them apart. Which is exactly where
   * it went missing.
   */
  const upcoming = useMemo(
    () => courses.filter((c) => c.term && isUpcomingTerm(c.term) && c.term !== currentTermName()),
    [courses],
  )
  // A finished term name alone is NOT enough to move a live course out of This
  // term: a class added in late August is filed under Summer and is the one the
  // student is attending in September (TKT-1034). Only a course with evidence it
  // is over (a final grade, or all its work dated before this term) is offered
  // for filing; everything else stays visible here.
  const unfiled = useMemo(() => {
    const now = new Date()
    return courses.filter(
      (c) =>
        c.term &&
        isFinishedTerm(c.term, now) &&
        looksFinished(
          {
            finalPercent: c.finalPercent,
            finalLetter: c.finalLetter,
            dues: assessments.filter((a) => a.courseId === c.id).map((a) => a.due),
          },
          now,
        ),
    )
  }, [courses, assessments])
  const thisTerm = useMemo(
    () => courses.filter((c) => !upcoming.includes(c) && !unfiled.includes(c)),
    [courses, upcoming, unfiled],
  )
  const shown = useMemo(
    () => sortByOrder(tab === 'upcoming' ? upcoming : thisTerm),
    [sortByOrder, tab, upcoming, thisTerm],
  )

  const byCourse = useMemo(() => {
    const map = new Map<string, typeof assessments>()
    for (const c of courses) map.set(c.id, [])
    for (const a of assessments) map.get(a.courseId)?.push(a)
    return map
  }, [courses, assessments])

  const showGpa = useShownGpa()
  const gpa = useMemo(() => currentGpa(courses, assessments), [courses, assessments])
  /**
   * Everything graded, this term and every term before it.
   *
   * Credit-weighted by the same function the term figure uses, so the two
   * cannot disagree about how a 3.5-credit class counts.
   */
  const overallGpa = useMemo(
    () => currentGpa([...pastCourses, ...courses], assessments),
    [pastCourses, courses, assessments],
  )
  const overallCredits = useMemo(
    // Past credits are credits earned (a retake counts once, a fail earns none).
    () => summarizeRecord(pastCourses, assessments).credits + courses.reduce((sum, c) => sum + c.credits, 0),
    [pastCourses, courses, assessments],
  )
  const open = assessments.filter((a) => isOpen(a.status))
  const coursesGraded = courses.filter(
    (c) => coursePercent(byCourse.get(c.id) ?? []) !== null,
  ).length
  const credits = courses.reduce((sum, c) => sum + c.credits, 0)
  const overdue = open.filter((a) => !!a.due && daysUntil(a.due) < 0).length
  const next = open
    .filter((a) => !!a.due && daysUntil(a.due) >= 0)
    .sort(byDue)
    .slice(0, 5)

  return (
    <div className="mx-auto w-full max-w-[1600px] px-5 py-5 sm:px-6">
      {preview && (
        <p className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-dashed border-border-strong px-4 py-2.5 text-[13px] text-muted">
          <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold tracking-[0.08em] text-accent-contrast uppercase">Preview</span>
          Classes opened from here use the proposed class page. The live one is unchanged.
          <Link to="/app/courses" className="ml-auto font-medium text-accent hover:underline">
            Back to Courses
          </Link>
        </p>
      )}
      <CoursesHero
        eyebrow={`${t('courses.title')} · ${tab === 'upcoming' ? 'Terms ahead' : term.name}`}
        gpa={showGpa(gpa)}
        classes={thisTerm.length}
        credits={credits}
        graded={coursesGraded}
        open={open.length}
        overdue={overdue}
        actions={
          <>
            {tab === 'upcoming' && <AddForTerm />}
            {!showPast && tab !== 'upcoming' && <ViewToggle view={coursesView} onChange={setCoursesView} />}
            {/* Says what it DOES, and opens the chooser rather than committing to
                one of the three ways in before asking which you want. Full width
                on a phone, where it is the thing you are most likely to want. */}
            {tab !== 'upcoming' && (
              <button
                type="button"
                onClick={() => setChooserOpen(true)}
                data-coach="add-course"
                data-tour="import-course"
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-white px-4 py-2.5 text-[13.5px] font-semibold text-black transition-colors duration-150 hover:bg-white/90 sm:flex-none"
              >
                <Plus size={16} aria-hidden />
                {t('courses.addCourse')}
              </button>
            )}
          </>
        }
      />

      {/* This term ⇄ Past semesters. Stays inside Courses (the app keeps exactly
          four top-level destinations). */}
      <div role="tablist" aria-label={t('courses.termsAria')} className="mt-5 mb-5 flex flex-wrap gap-2">
        {([
          { id: 'current', label: t('courses.thisTerm') },
          // Always offered, even empty. It used to appear only once it had
          // something in it, so the feature was invisible to exactly the people
          // who needed telling it existed — you cannot find the place to enter
          // next term's classes if that place only appears after you have
          // entered them.
          {
            id: 'upcoming',
            label: upcoming.length > 0 ? `Upcoming (${upcoming.length})` : 'Upcoming',
          },
          {
            id: 'past',
            label: `${t('courses.pastSemesters')}${pastCourses.length ? ` (${pastCourses.length})` : ''}`,
          },
        ] as const).map((item) => {
          const active = item.id === tab
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(item.id)}
              className={cn(
                'rounded-full px-4 py-2 text-[13.5px] font-semibold whitespace-nowrap transition-colors duration-150',
                active ? 'bg-fg text-canvas' : 'border border-border text-muted hover:border-border-strong hover:text-fg',
              )}
            >
              {item.label}
            </button>
          )
        })}
      </div>

      {showPast && (
        <>
          <UnfiledPastCourses courses={unfiled} />
          <TranscriptView />
        </>
      )}

      {/* Upcoming is its own view, not the current-term grid with a filter: it
          has no rail, because a GPA and an overdue count for classes that have
          not started would both read zero and mean nothing. */}
      {tab === 'upcoming' && <UpcomingCourses courses={upcoming} byCourse={byCourse} />}

      <div
        className={cn(
          'flex flex-col gap-5 lg:flex-row lg:items-start',
          tab !== 'current' && 'hidden',
        )}
      >
        <main className="order-2 min-w-0 flex-1 lg:order-1">
          {/* Above the grid, because both are statements ABOUT the list below
              it. Only one can ever show: a gap report when Moodle is
              connected, an offer when it is not. */}
          <MoodleClassNudge />
          <MoodleConnectCard />
          {coursesView === 'grid' ? (
            <div className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 2xl:grid-cols-3">
              {shown.map((c) => (
                <Draggable
                  key={c.id}
                  id={c.id}
                  dragId={dragId}
                  overId={overId}
                  onStart={setDragId}
                  onOver={setOverId}
                  onDrop={(from) => {
                    moveCourse(shown, from, c.id)
                    setDragId(null)
                    setOverId(null)
                  }}
                >
                  <CourseGridCard course={c} assessments={byCourse.get(c.id) ?? []} detailBase={detailBase} />
                </Draggable>
              ))}
              {/* Moodle sits with the classes, in their shape, and opens like one. */}
              <MoodleGridCard />
              <AddCourseCard onClick={() => setChooserOpen(true)} />
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {/* `shown`, not `courses` — the list view was ignoring the tab
                  and showing next term's classes alongside this term's. */}
              {shown.map((c) => (
                <Draggable
                  key={c.id}
                  id={c.id}
                  dragId={dragId}
                  overId={overId}
                  onStart={setDragId}
                  onOver={setOverId}
                  onDrop={(from) => {
                    moveCourse(shown, from, c.id)
                    setDragId(null)
                    setOverId(null)
                  }}
                >
                  <CourseCard course={c} assessments={byCourse.get(c.id) ?? []} />
                </Draggable>
              ))}
              <MoodleListRow />
              <AddCourseRow onClick={() => setChooserOpen(true)} />
            </div>
          )}
        </main>

        <aside className="order-1 flex flex-col gap-4 lg:order-2 lg:w-[320px] lg:shrink-0">
          <CoursesRail
            gpa={showGpa(gpa)}
            overallGpa={showGpa(overallGpa)}
            credits={credits}
            overallCredits={overallCredits}
            next={next}
            courses={courses}
            detailBase={detailBase}
          />
          {plan === 'free' && <PaywallCallout />}
        </aside>
      </div>

      {chooserOpen && <AddCourseChooser onClose={() => setChooserOpen(false)} />}
    </div>
  )
}

/** The "+" tile at the end of the grid — matches a course card's footprint, but
 * dashed + muted so it reads as an action, not a class. Opens the add chooser. */
function AddCourseCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-border-strong px-4 py-6 text-center transition-colors duration-150 hover:border-accent/60 hover:bg-surface"
    >
      <span className="grid size-12 place-items-center rounded-full bg-surface-2 text-muted transition-colors duration-150 group-hover:bg-accent group-hover:text-accent-contrast">
        <Plus size={22} aria-hidden />
      </span>
      <span className="text-[13px] font-medium text-muted transition-colors duration-150 group-hover:text-fg">
        Add a course
      </span>
    </button>
  )
}

/** The List-view counterpart to the "+" card — a dashed action row. */
function AddCourseRow({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex items-center gap-2.5 rounded-2xl border border-dashed border-border-strong bg-surface/40 px-4 py-3 text-left transition-colors duration-150 hover:border-accent/60 hover:bg-surface-2"
    >
      <span className="grid size-7 place-items-center rounded-full bg-surface-2 text-muted transition-colors duration-150 group-hover:bg-accent-soft group-hover:text-accent">
        <Plus size={16} aria-hidden />
      </span>
      <span className="text-[13px] font-medium text-muted transition-colors duration-150 group-hover:text-fg">
        Add a course
      </span>
    </button>
  )
}

const VIEW_OPTIONS: { value: CoursesView; label: string; icon: typeof LayoutGrid }[] = [
  { value: 'grid', label: 'Grid', icon: LayoutGrid },
  { value: 'list', label: 'List', icon: Rows3 },
]

/** Segmented List | Grid switch — the Courses layout option. */
function ViewToggle({
  view,
  onChange,
}: {
  view: CoursesView
  onChange: (view: CoursesView) => void
}) {
  const t = useT()
  return (
    <div
      role="radiogroup"
      aria-label={t('courses.layoutAria')}
      className="flex gap-1 rounded-full bg-white/15 p-1 backdrop-blur-md"
    >
      {VIEW_OPTIONS.map((opt) => {
        const active = view === opt.value
        const Icon = opt.icon
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={`${opt.label} view`}
            title={`${opt.label} view`}
            onClick={() => onChange(opt.value)}
            className={cn(
              'grid size-8 place-items-center rounded-full transition-colors duration-150',
              active ? 'bg-white text-black' : 'text-white/75 hover:text-white',
            )}
          >
            <Icon size={15} aria-hidden />
          </button>
        )
      })}
    </div>
  )
}

/**
 * One draggable class card.
 *
 * HTML5 drag rather than pointer maths: the browser gives the drag image, the
 * cursor and the drop semantics for free, and a class card is a big target that
 * does not need pixel precision. Mouse and pen only in practice — touch does
 * not fire these events, and hijacking a touch-drag would break scrolling the
 * list, which is the far more common gesture on a phone.
 *
 * The order is saved the moment you let go. There is no "save arrangement"
 * button, because an arrangement you have to confirm is one you will lose.
 */
function Draggable({
  id,
  dragId,
  overId,
  onStart,
  onOver,
  onDrop,
  children,
}: {
  id: string
  dragId: string | null
  overId: string | null
  onStart: (id: string | null) => void
  onOver: (id: string | null) => void
  onDrop: (from: string) => void
  children: React.ReactNode
}) {
  const dragging = dragId === id
  const target = overId === id && dragId !== null && dragId !== id
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', id)
        onStart(id)
      }}
      onDragEnd={() => {
        onStart(null)
        onOver(null)
      }}
      onDragOver={(e) => {
        if (!dragId) return
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        if (overId !== id) onOver(id)
      }}
      onDragLeave={() => {
        if (overId === id) onOver(null)
      }}
      onDrop={(e) => {
        e.preventDefault()
        const from = e.dataTransfer.getData('text/plain') || dragId
        if (from) onDrop(from)
      }}
      className={cn(
        // h-full because THIS is the grid item now — without it the card
        // stretches to nothing and the row goes ragged again.
        'h-full rounded-3xl transition-[opacity,box-shadow] duration-150',
        dragging && 'opacity-40',
        target && 'ring-2 ring-accent ring-offset-2 ring-offset-canvas',
      )}
    >
      {children}
    </div>
  )
}
