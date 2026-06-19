import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, ChevronDown, Loader2, Sprout } from 'lucide-react'
import type { Course } from '@/data/types'
import { blueprintToAssessments, netVotes, type Blueprint } from '@/data/blueprints'
import { term } from '@/data/mock'
import { useAppData } from '@/app/providers/app-data'
import { cn } from '@/lib/cn'
import { BlueprintRow } from './BlueprintRow'
import { BlueprintContributeModal } from './BlueprintContributeModal'
import { useCourseBlueprints } from './useBlueprints'

const byNet = (a: Blueprint, b: Blueprint) => netVotes(b) - netVotes(a)
const ALL = 'all'

/** The ranked blueprint list for one course, scoped to a SECTION. The filter
 * defaults to the student's enrolled section (known from enrollment, not guessed)
 * and warns when they view another. Within the active section: current-term
 * blueprints rank with a teacher-verified pin + community collapse; past-term
 * versions are hidden behind an expander (dates may have moved).
 *
 * Data is REAL (Phase 5): blueprints are fetched from `shared_blueprints` by the
 * course code, votes persist to `blueprint_votes`, and importing materializes the
 * outline as real assignments on THIS course. */
export function BlueprintList({ course }: { course: Course }) {
  const navigate = useNavigate()
  const { user, assessments } = useAppData()
  const { blueprints, votes, loading, castVote, recordImport, contribute } =
    useCourseBlueprints(course)
  const [contributeOpen, setContributeOpen] = useState(false)

  const sections = useMemo(
    () => [...new Set(blueprints.map((b) => b.section))].filter(Boolean),
    [blueprints],
  )
  const yourSection = course.section
  // Section tabs put the enrolled section first IF it's known + has blueprints.
  const orderedSections = useMemo(() => {
    if (yourSection && sections.includes(yourSection))
      return [yourSection, ...sections.filter((s) => s !== yourSection)]
    return sections
  }, [sections, yourSection])

  // Default to ALL — show every section's outlines; don't assume your section
  // (it's often unknown for a course added from the marketplace). Sections are an
  // optional filter you can click.
  const [activeSection, setActiveSection] = useState<string>(ALL)

  const courseAssessments = assessments.filter((a) => a.courseId === course.id)

  const sectionBps =
    activeSection === ALL ? blueprints : blueprints.filter((b) => b.section === activeSection)
  const current = sectionBps.filter((b) => b.term === term.name)
  const past = sectionBps.filter((b) => b.term !== term.name).sort(byNet)
  const teacher = current.find((b) => b.teacherVerified) ?? null
  const community = current.filter((b) => !b.teacherVerified).sort(byNet)
  // Only a real, known mismatch warns — never when viewing "All" or with no section.
  const mismatch = activeSection !== ALL && !!yourSection && activeSection !== yourSection

  function importBlueprint(b: Blueprint) {
    recordImport(b.id)
    // CourseDetailPage's import handler stamps the real course id on each item.
    navigate(`/app/courses/${course.id}`, { state: { importItems: blueprintToAssessments(b) } })
  }
  const rowProps = (b: Blueprint) => ({
    blueprint: b,
    yourSection,
    userVote: votes[b.id] ?? 0,
    onVote: (dir: 1 | -1) => castVote(b.id, dir),
    onImport: () => importBlueprint(b),
  })

  if (loading) {
    return (
      <div className="grid place-items-center rounded-xl border border-dashed border-border bg-surface/50 py-14">
        <Loader2 className="size-5 animate-spin text-accent" aria-label="Loading blueprints" />
      </div>
    )
  }

  if (blueprints.length === 0) {
    return (
      <>
        <BlueprintEmptyState course={course} onContribute={() => setContributeOpen(true)} />
        {contributeOpen && (
          <BlueprintContributeModal
            course={course}
            onSubmit={() => contribute(courseAssessments, user.name)}
            onClose={() => setContributeOpen(false)}
          />
        )}
      </>
    )
  }

  return (
    <div>
      {sections.length > 1 && (
        <div role="tablist" aria-label="Section" className="mb-3 flex flex-wrap gap-1.5">
          <SectionTab label="All" active={activeSection === ALL} onClick={() => setActiveSection(ALL)} />
          {orderedSections.map((s) => (
            <SectionTab
              key={s}
              label={`Section ${s}`}
              yours={!!yourSection && s === yourSection}
              active={activeSection === s}
              onClick={() => setActiveSection(s)}
            />
          ))}
        </div>
      )}

      {mismatch && (
        <div className="mb-3 flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2.5 text-[12px] text-warning">
          <AlertTriangle size={15} className="mt-px shrink-0" aria-hidden />
          <p>
            You're enrolled in <strong>section {yourSection}</strong> — these are for{' '}
            <strong>section {activeSection}</strong>, whose dates may differ.{' '}
            <button
              type="button"
              onClick={() => setActiveSection(yourSection)}
              className="font-medium underline underline-offset-2"
            >
              Show section {yourSection}
            </button>
          </p>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {current.length === 0 && past.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border-strong bg-surface/50 px-4 py-8 text-center text-[13px] text-subtle">
            No blueprints {activeSection === ALL ? 'yet' : `for section ${activeSection} yet`}.
          </p>
        ) : (
          <>
            {/* Current-term: teacher-verified pinned, community collapsed behind it. */}
            {teacher ? (
              <>
                <BlueprintRow {...rowProps(teacher)} pinned />
                {community.length > 0 && (
                  <Collapser
                    summary={`${community.length} community version${community.length === 1 ? '' : 's'}`}
                    hint="hidden while a teacher version exists"
                  >
                    {community.map((b) => (
                      <BlueprintRow key={b.id} {...rowProps(b)} />
                    ))}
                  </Collapser>
                )}
              </>
            ) : current.length > 0 ? (
              community.map((b) => <BlueprintRow key={b.id} {...rowProps(b)} />)
            ) : null}

            {/* Past-term: collapsed when there are also current ones; shown directly
                (so they don't read as "empty") when they're all that's available. */}
            {past.length > 0 &&
              (current.length > 0 ? (
                <Collapser
                  summary={`${past.length} from past term${past.length === 1 ? '' : 's'}`}
                  hint="older — dates may have changed"
                >
                  {past.map((b) => (
                    <BlueprintRow key={b.id} {...rowProps(b)} />
                  ))}
                </Collapser>
              ) : (
                <>
                  <p className="px-1 text-[12px] text-subtle">
                    From a past term — dates may have changed.
                  </p>
                  {past.map((b) => (
                    <BlueprintRow key={b.id} {...rowProps(b)} />
                  ))}
                </>
              ))}
          </>
        )}
      </div>

      <button
        type="button"
        onClick={() => setContributeOpen(true)}
        className="mt-5 inline-flex items-center gap-2 text-[12px] text-subtle transition-colors duration-150 hover:text-accent"
      >
        <Sprout size={14} aria-hidden />
        Contribute your outline — earn theme credits
      </button>

      {contributeOpen && (
        <BlueprintContributeModal
          course={course}
          onSubmit={() => contribute(courseAssessments, user.name)}
          onClose={() => setContributeOpen(false)}
        />
      )}
    </div>
  )
}

/** One section-filter tab ("All" + each section), with an optional "yours" badge
 * when the section matches the student's known enrollment. */
function SectionTab({
  label,
  active,
  yours = false,
  onClick,
}: {
  label: string
  active: boolean
  yours?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-medium transition-colors duration-150',
        active
          ? 'border-accent bg-accent-soft text-fg'
          : 'border-border bg-surface text-muted hover:text-fg',
      )}
    >
      {label}
      {yours && (
        <span className="rounded bg-accent/15 px-1 py-0.5 text-[9px] font-bold tracking-wide text-accent uppercase">
          yours
        </span>
      )}
    </button>
  )
}

/** A quiet collapsible group — used for the community-versions and past-term
 * stacks, both hidden by default but one click away (nothing is deleted). */
function Collapser({
  summary,
  hint,
  children,
}: {
  summary: string
  hint?: string
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[12px] text-subtle transition-colors duration-150 hover:bg-surface-2 hover:text-muted"
      >
        <ChevronDown
          size={15}
          className={cn('transition-transform duration-150', open && 'rotate-180')}
          aria-hidden
        />
        {summary}
        {hint && <span className="text-subtle/70">· {hint}</span>}
      </button>
      {open && <div className="mt-2 flex flex-col gap-2 pl-2">{children}</div>}
    </div>
  )
}

function BlueprintEmptyState({
  course,
  onContribute,
}: {
  course: Course
  onContribute: () => void
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border-strong bg-surface/50 px-6 py-14 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-accent-soft text-accent">
        <Sprout size={24} aria-hidden />
      </span>
      <h3 className="font-display text-xl font-medium text-fg">
        No blueprint yet for {course.code}
      </h3>
      <p className="max-w-sm text-sm text-muted">
        Be the first to share this course's outline. Contribute one and earn
        <span className="text-accent"> theme credits</span>.
      </p>
      <button
        type="button"
        onClick={onContribute}
        className="mt-1 inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-[13px] font-medium text-accent-contrast shadow-sm transition-colors duration-150 hover:bg-accent-hover"
      >
        Contribute a blueprint
      </button>
    </div>
  )
}
