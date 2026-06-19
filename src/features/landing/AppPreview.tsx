import { useEffect, useState } from 'react'
import {
  BookOpen,
  CalendarDays,
  Check,
  LayoutDashboard,
  Search,
  Users,
} from 'lucide-react'
import { courses, seedAssessments, term } from '@/data/mock'
import type { Assessment } from '@/data/types'
import { daysUntil, relativeDueLabel, termProgress } from '@/lib/date'
import { currentGpa } from '@/lib/gpa'
import { KIND_LABEL } from '@/lib/assessment'
import { usePrefersReducedMotion } from '@/app/hooks/usePrefersReducedMotion'
import { CourseChip } from '@/components/CourseChip'
import { ProvenanceBadge } from '@/components/ProvenanceBadge'
import { cn } from '@/lib/cn'

/** A static, non-interactive recreation of the real Today screen — built from
 * the actual mock data + shared components (CourseChip, ProvenanceBadge) so the
 * landing's hero "peek" is the genuine product, not a screenshot. Pointer events
 * are disabled by the caller; nothing here is wired to the store. */
const courseById = (id: string) => courses.find((c) => c.id === id)

const dueItems: Assessment[] = seedAssessments
  .filter((a) => a.status === 'not-started')
  .sort((a, b) => daysUntil(a.due) - daysUntil(b.due))
  .slice(0, 6)

const gpa = currentGpa(courses, seedAssessments)

function dueTone(due: string): string {
  const d = daysUntil(due)
  if (d < 0) return 'text-danger'
  if (d === 0) return 'text-warning'
  return 'text-fg'
}

export function AppPreview({ name }: { name?: string }) {
  const { week, totalWeeks, percent } = termProgress(term.start, term.end)
  const overdue = dueItems.filter((a) => daysUntil(a.due) < 0)
  const thisWeek = dueItems.filter((a) => daysUntil(a.due) >= 0)
  // Landing keeps the default sample identity; onboarding passes the real user.
  const displayName = name?.trim() || 'Alex Degryse'
  const firstName = displayName.split(/\s+/)[0]
  const initials =
    displayName.split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || 'U'

  return (
    <div className="flex h-full min-h-0 text-left">
      {/* Sidebar */}
      <aside className="hidden w-48 shrink-0 flex-col border-r border-border bg-surface/60 px-3 py-4 sm:flex">
        <div className="flex items-center gap-2 px-1.5">
          <span className="grid size-6 place-items-center rounded-md bg-surface-2">
            <span className="block size-2.5 rounded-full bg-accent" />
          </span>
          <span className="font-display text-[14px] font-medium text-fg">
            Concordia<span className="text-muted">Tracker</span>
          </span>
        </div>

        <div className="mt-4 flex items-center gap-2 rounded-md border border-border bg-canvas/60 px-2 py-1.5 text-[11px] text-subtle">
          <Search size={12} />
          <span>Search…</span>
          <span className="ml-auto rounded border border-border px-1 text-[9px]">⌘K</span>
        </div>

        <nav className="mt-4 space-y-0.5">
          <NavItem icon={LayoutDashboard} label="Today" active />
          <NavItem icon={BookOpen} label="Courses" />
          <NavItem icon={CalendarDays} label="Calendar" />
          <NavItem icon={Users} label="Community" />
        </nav>

        <div className="mt-auto flex items-center gap-2 border-t border-border pt-3">
          <span className="grid size-7 place-items-center rounded-full bg-accent-soft text-[10px] font-semibold text-accent">
            {initials}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[11px] font-medium text-fg">{displayName}</span>
            <span className="block text-[10px] text-subtle">Free plan</span>
          </span>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col px-4 py-4">
        <header className="mb-3">
          <p className="text-[10px] text-subtle">Monday, June 15</p>
          <TypedGreeting text={`Good morning, ${firstName}`} />
        </header>

        <div className="flex min-h-0 flex-1 gap-3">
          {/* Due list */}
          <div className="min-w-0 flex-1 overflow-hidden rounded-xl border border-border bg-surface">
            <div className="flex items-center justify-between border-b border-border px-3 py-2">
              <span className="text-[11px] font-semibold tracking-wide text-fg uppercase">Due</span>
              <span className="text-[10px] text-subtle">{dueItems.length} items</span>
            </div>
            <GroupLabel tone="danger">Overdue</GroupLabel>
            <ul className="divide-y divide-border">
              {overdue.map((a) => (
                <PreviewRow key={a.id} a={a} />
              ))}
            </ul>
            <GroupLabel tone="muted" divider>
              This week
            </GroupLabel>
            <ul className="divide-y divide-border">
              {thisWeek.map((a) => (
                <PreviewRow key={a.id} a={a} />
              ))}
            </ul>
          </div>

          {/* Glance rail */}
          <div className="hidden w-44 shrink-0 flex-col gap-2 lg:flex">
            <div className="overflow-hidden rounded-xl border border-border/60 bg-surface/50">
              <p className="border-b border-border/60 px-3 py-2 text-[10px] font-semibold tracking-wide text-subtle uppercase">
                At a glance
              </p>
              <div className="space-y-2.5 border-b border-border/60 px-3 py-2.5">
                <Bar label={term.name} value={`Week ${week} of ${totalWeeks}`} percent={percent} />
                <Bar label="Today's progress" value="1 done · 7 to go" percent={12} accent />
              </div>
              <div className="divide-y divide-border/60">
                <Stat label="Current GPA" value={gpa ? gpa.toFixed(2) : '—'} hint="/ 4.30" />
                <Stat label="Overdue" value={String(overdue.length)} danger />
                <Stat label="Due this week" value={String(dueItems.length)} />
              </div>
            </div>
            <div className="rounded-xl border border-accent/30 bg-accent-soft px-3 py-2.5">
              <p className="text-[11px] font-semibold text-fg">7 things due this week</p>
              <p className="mt-0.5 text-[10px] text-muted">See where to spend your energy.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Types the greeting out once after the embed has slid in. Plain JS sequencing
 * (no animation lib), gated on reduced-motion: when motion is reduced the full
 * greeting is shown immediately and no caret renders. */
function TypedGreeting({ text }: { text: string }) {
  const reduced = usePrefersReducedMotion()
  const [count, setCount] = useState(() => (reduced ? text.length : 0))

  useEffect(() => {
    if (reduced) {
      const settle = setTimeout(() => setCount(text.length), 0)
      return () => clearTimeout(settle)
    }
    let i = 0
    let typeTimer: ReturnType<typeof setTimeout>
    const type = () => {
      i += 1
      setCount(i)
      if (i < text.length) typeTimer = setTimeout(type, 48)
    }
    // wait for the slide-in (~480ms) to land before the first keystroke
    const startTimer = setTimeout(type, 540)
    return () => {
      clearTimeout(startTimer)
      clearTimeout(typeTimer)
    }
  }, [reduced, text])

  const done = count >= text.length

  return (
    <h3 className="font-display text-[18px] leading-tight font-medium text-fg">
      {text.slice(0, count)}
      {!reduced && !done && <span className="ct-caret" aria-hidden />}
    </h3>
  )
}

function NavItem({
  icon: Icon,
  label,
  active = false,
}: {
  icon: typeof BookOpen
  label: string
  active?: boolean
}) {
  return (
    <span
      className={cn(
        'flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[12px]',
        active ? 'bg-surface-2 font-medium text-fg' : 'text-subtle',
      )}
    >
      <Icon size={14} className={active ? 'text-accent' : ''} />
      {label}
    </span>
  )
}

function PreviewRow({ a }: { a: Assessment }) {
  const course = courseById(a.courseId)
  return (
    <li className="flex items-start gap-2.5 px-3 py-2">
      <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border border-border-strong text-transparent">
        <Check size={10} strokeWidth={3} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12px] font-medium text-fg">{a.title}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] text-subtle">
          {course && <CourseChip code={course.code} color={course.color} className="text-[9px]" />}
          <span>
            {KIND_LABEL[a.kind]} · {a.weight}%
          </span>
          <ProvenanceBadge provenance={a.provenance} tone="quiet" className="text-[10px]" />
        </div>
      </div>
      <span className={cn('shrink-0 pt-0.5 text-[11px] font-semibold', dueTone(a.due))}>
        {relativeDueLabel(a.due)}
      </span>
    </li>
  )
}

function GroupLabel({
  tone,
  divider = false,
  children,
}: {
  tone: 'danger' | 'muted'
  divider?: boolean
  children: React.ReactNode
}) {
  return (
    <p
      className={cn(
        'px-3 pt-2 pb-1 text-[9px] font-semibold tracking-wide uppercase',
        divider && 'border-t border-border',
        tone === 'danger' ? 'text-danger' : 'text-subtle',
      )}
    >
      {children}
    </p>
  )
}

function Bar({
  label,
  value,
  percent,
  accent = false,
}: {
  label: string
  value: string
  percent: number
  accent?: boolean
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[10px] text-subtle">{label}</span>
        <span className="text-[10px] font-medium text-fg">{value}</span>
      </div>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-surface-2">
        <div
          className={cn('h-full rounded-full', accent ? 'bg-accent' : 'bg-border-strong')}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}

function Stat({
  label,
  value,
  hint,
  danger = false,
}: {
  label: string
  value: string
  hint?: string
  danger?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-2 px-3 py-1.5">
      <span className="text-[10px] text-subtle">{label}</span>
      <span className={cn('text-[12px] font-semibold', danger ? 'text-danger' : 'text-fg')}>
        {value}
        {hint && <span className="ml-1 text-[9px] font-normal text-subtle">{hint}</span>}
      </span>
    </div>
  )
}
