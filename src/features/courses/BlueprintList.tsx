import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, ChevronDown, Sprout } from 'lucide-react'
import type { Course } from '@/data/types'
import {
  blueprintToAssessments,
  blueprintsForCourse,
  netVotes,
  type Blueprint,
} from '@/data/blueprints'
import { term } from '@/data/mock'
import { useTeacher } from '@/app/providers/teacher'
import { cn } from '@/lib/cn'
import { BlueprintRow } from './BlueprintRow'
import { BlueprintContributeModal } from './BlueprintContributeModal'

type Dir = 1 | -1 | 0
const byNet = (a: Blueprint, b: Blueprint) => netVotes(b) - netVotes(a)

/** The ranked blueprint list for one course, scoped to a SECTION. The filter
 * defaults to the student's enrolled section (known from enrollment, not guessed)
 * and warns when they view another. Within the active section: current-term
 * blueprints rank with a teacher-verified pin + community collapse; past-term
 * versions are hidden behind an expander (dates may have moved). */
export function BlueprintList({ course }: { course: Course }) {
  const navigate = useNavigate()
  const { publishedBlueprints, absorbedBlueprintIds } = useTeacher()
  const [votes, setVotes] = useState<Record<string, Dir>>({})
  const [contributeOpen, setContributeOpen] = useState(false)

  // Community uploads (minus any a teacher has verified into their own) + the
  // teacher-verified blueprints published from the portal.
  const blueprints = useMemo(
    () => [
      ...blueprintsForCourse(course.id).filter((b) => !absorbedBlueprintIds.includes(b.id)),
      ...publishedBlueprints.filter((b) => b.courseId === course.id),
    ],
    [course.id, publishedBlueprints, absorbedBlueprintIds],
  )
  const sections = useMemo(() => [...new Set(blueprints.map((b) => b.section))], [blueprints])
  const yourSection = course.section
  // Tabs: every section with blueprints, the enrolled one first (and always shown).
  const ordered = useMemo(() => {
    const rest = sections.filter((s) => s !== yourSection)
    return [yourSection, ...rest]
  }, [sections, yourSection])

  // No guessed default — the filter lands on the student's enrolled section.
  const [activeSection, setActiveSection] = useState(yourSection)

  const sectionBps = blueprints.filter((b) => b.section === activeSection)
  const current = sectionBps.filter((b) => b.term === term.name)
  const past = sectionBps.filter((b) => b.term !== term.name).sort(byNet)
  const teacher = current.find((b) => b.teacherVerified) ?? null
  const community = current.filter((b) => !b.teacherVerified).sort(byNet)
  const mismatch = activeSection !== yourSection

  function vote(id: string, dir: 1 | -1) {
    setVotes((v) => ({ ...v, [id]: v[id] === dir ? 0 : dir }))
  }
  function importBlueprint(b: Blueprint) {
    navigate(`/app/courses/${course.id}`, { state: { importItems: blueprintToAssessments(b) } })
  }
  const rowProps = (b: Blueprint) => ({
    blueprint: b,
    yourSection,
    userVote: votes[b.id] ?? 0,
    onVote: (dir: 1 | -1) => vote(b.id, dir),
    onImport: () => importBlueprint(b),
  })

  if (blueprints.length === 0) {
    return (
      <>
        <BlueprintEmptyState course={course} onContribute={() => setContributeOpen(true)} />
        {contributeOpen && (
          <BlueprintContributeModal course={course} onClose={() => setContributeOpen(false)} />
        )}
      </>
    )
  }

  return (
    <div>
      {ordered.length > 1 && (
        <div role="tablist" aria-label="Section" className="mb-3 flex flex-wrap gap-1.5">
          {ordered.map((s) => {
            const active = s === activeSection
            return (
              <button
                key={s}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveSection(s)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-medium transition-colors duration-150',
                  active
                    ? 'border-accent bg-accent-soft text-fg'
                    : 'border-border bg-surface text-muted hover:text-fg',
                )}
              >
                Section {s}
                {s === yourSection && (
                  <span className="rounded bg-accent/15 px-1 py-0.5 text-[9px] font-bold tracking-wide text-accent uppercase">
                    yours
                  </span>
                )}
              </button>
            )
          })}
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
            No blueprints for section {activeSection} yet.
          </p>
        ) : (
          <>
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
            ) : (
              <p className="rounded-xl border border-dashed border-border-strong bg-surface/50 px-4 py-6 text-center text-[13px] text-subtle">
                No current-term blueprints for section {activeSection}.
              </p>
            )}

            {past.length > 0 && (
              <Collapser
                summary={`${past.length} from past term${past.length === 1 ? '' : 's'}`}
                hint="older — dates may have changed"
              >
                {past.map((b) => (
                  <BlueprintRow key={b.id} {...rowProps(b)} />
                ))}
              </Collapser>
            )}
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
        <BlueprintContributeModal course={course} onClose={() => setContributeOpen(false)} />
      )}
    </div>
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
