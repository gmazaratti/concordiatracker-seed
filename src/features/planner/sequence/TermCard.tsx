import { useState } from 'react'
import { ArrowLeft, ArrowRight, Ban, Briefcase, Check, CircleHelp, Lock, Repeat, TriangleAlert, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { planKey, type PlanCheck, type PlanCourse, type PlanVerdict } from '@/lib/course-plan'
import { AddPlanCourse } from './AddPlanCourse'

export interface ShownCourse extends PlanCourse {
  /** Already added in Courses for this term: shown, checked, not editable here. */
  locked?: boolean
}

const MARK: Record<PlanVerdict, { icon: typeof Check; tone: string; label: string }> = {
  ok: { icon: Check, tone: 'text-success', label: 'Prerequisites come before it' },
  missing: { icon: TriangleAlert, tone: 'text-warning', label: 'A prerequisite is not before it' },
  unsure: { icon: CircleHelp, tone: 'text-subtle', label: 'Worth checking' },
  blocked: { icon: Ban, tone: 'text-danger', label: 'Not for credit' },
  repeat: { icon: Repeat, tone: 'text-subtle', label: 'Listed twice' },
}
const BTN =
  'grid size-7 shrink-0 place-items-center rounded-full text-subtle transition-colors duration-150 hover:bg-surface-2 hover:text-fg disabled:opacity-25 disabled:hover:bg-transparent'

/**
 * One coming semester: its courses, each marked against what comes before it,
 * the credit total, and whether it is a work term. Courses can be dragged
 * between terms with a mouse; the arrows do the same for touch and keyboard.
 */
export function TermCard({
  index,
  term,
  work,
  courses,
  checks,
  credits,
  prevTerm,
  nextTermName,
  canRemove,
  onAdd,
  onRemove,
  onMove,
  onWork,
  onDropCourse,
  onFix,
  onRemoveTerm,
}: {
  index: number
  term: string
  work: boolean
  courses: ShownCourse[]
  checks: Map<string, PlanCheck>
  credits: number
  prevTerm: string | null
  nextTermName: string | null
  canRemove: boolean
  onAdd: (c: PlanCourse) => void
  onRemove: (code: string) => void
  onMove: (code: string, by: -1 | 1) => void
  onWork: (work: boolean) => void
  onDropCourse: (from: number, code: string) => void
  /** Put a missing prerequisite into the term before this one. */
  onFix: (code: string) => void
  onRemoveTerm: () => void
}) {
  const [over, setOver] = useState(false)
  return (
    <section
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('text/ct-plan')) {
          e.preventDefault()
          setOver(true)
        }
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        setOver(false)
        const raw = e.dataTransfer.getData('text/ct-plan')
        if (!raw) return
        e.preventDefault()
        const [from, code] = raw.split('|')
        onDropCourse(Number(from), code)
      }}
      className={cn(
        'flex flex-col rounded-3xl border bg-surface p-4 transition-colors duration-150',
        over ? 'border-accent' : work ? 'border-info/40' : 'border-border',
      )}
    >
      <header className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-[17px] leading-tight font-semibold text-fg">{term}</h3>
          <p className="mt-0.5 text-[12px] text-subtle tabular-nums">
            {work && courses.length === 0 ? 'Work term' : `${credits} credit${credits === 1 ? '' : 's'}${work ? ' · work term' : ''}`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onWork(!work)}
          aria-pressed={work}
          title={work ? 'This is a work term. Press to make it a study term.' : 'Mark as a work term'}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[12px] font-medium transition-colors duration-150',
            work ? 'bg-info/15 text-info' : 'text-muted hover:bg-surface-2 hover:text-fg',
          )}
        >
          <Briefcase size={13} aria-hidden /> Work term
        </button>
        {canRemove && (
          <button type="button" className={BTN} onClick={onRemoveTerm} aria-label={`Remove ${term} from the plan`} title="Remove this term">
            <X size={14} aria-hidden />
          </button>
        )}
      </header>

      <ul className="mt-3 flex-1 space-y-1.5">
        {courses.length === 0 && (
          <li className="rounded-xl bg-canvas px-3 py-4 text-center text-[12.5px] text-subtle">
            {work ? 'No classes planned.' : 'Nothing planned yet.'}
          </li>
        )}
        {courses.map((c) => {
          const check = checks.get(`${index}:${planKey(c.code)}`)
          const mark = MARK[check?.verdict ?? 'ok']
          const Icon = mark.icon
          return (
            <li
              key={c.code}
              draggable={!c.locked}
              onDragStart={(e) => {
                e.dataTransfer.setData('text/ct-plan', `${index}|${c.code}`)
                e.dataTransfer.effectAllowed = 'move'
              }}
              className={cn('rounded-xl bg-canvas px-3 py-2.5', !c.locked && 'lg:cursor-grab lg:active:cursor-grabbing')}
            >
              <div className="flex items-start gap-2">
                <span className={cn('mt-0.5 shrink-0', mark.tone)} title={mark.label}>
                  <Icon size={15} aria-hidden />
                  <span className="sr-only">{mark.label}</span>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] leading-snug text-fg">
                    <span className="font-semibold">{c.code}</span>
                    <span className="ml-1.5 text-[11.5px] text-subtle tabular-nums">{c.credits} cr</span>
                  </p>
                  {c.title && <p className="truncate text-[12px] text-subtle">{c.title}</p>}
                </div>
                {c.locked ? (
                  <span className="mt-0.5 inline-flex shrink-0 items-center gap-1 text-[11.5px] text-subtle" title="Already in your Courses for this term">
                    <Lock size={11} aria-hidden /> In Courses
                  </span>
                ) : (
                  <div className="flex shrink-0 items-center">
                    <button type="button" className={BTN} disabled={!prevTerm} onClick={() => onMove(c.code, -1)} aria-label={prevTerm ? `Move ${c.code} to ${prevTerm}` : 'Already in the first term'}>
                      <ArrowLeft size={13} aria-hidden />
                    </button>
                    <button type="button" className={BTN} disabled={!nextTermName} onClick={() => onMove(c.code, 1)} aria-label={nextTermName ? `Move ${c.code} to ${nextTermName}` : 'Already in the last term'}>
                      <ArrowRight size={13} aria-hidden />
                    </button>
                    <button type="button" className={BTN} onClick={() => onRemove(c.code)} aria-label={`Remove ${c.code} from ${term}`}>
                      <X size={13} aria-hidden />
                    </button>
                  </div>
                )}
              </div>
              {check?.message && (
                <p className={cn('mt-1.5 pl-[23px] text-[12px] leading-snug', check.verdict === 'missing' || check.verdict === 'blocked' ? 'text-fg' : 'text-subtle')}>
                  {check.message}
                </p>
              )}
              {check && check.fixes.length > 0 && prevTerm && (
                <div className="mt-1.5 flex flex-wrap gap-1.5 pl-[23px]">
                  {check.fixes.slice(0, 3).map((code) => (
                    <button
                      key={code}
                      type="button"
                      onClick={() => onFix(code)}
                      className="rounded-full bg-accent-soft px-2.5 py-1 text-[11.5px] font-medium text-accent transition-colors duration-150 hover:bg-accent hover:text-accent-contrast"
                    >
                      Put {code} in {prevTerm}
                    </button>
                  ))}
                </div>
              )}
            </li>
          )
        })}
      </ul>

      {!work && credits > 0 && credits < 12 && (
        <p className="mt-2 text-[11.5px] text-subtle">Under 12 credits counts as part-time at Concordia.</p>
      )}
      <div className="mt-3">
        <AddPlanCourse term={term} onAdd={onAdd} />
      </div>
    </section>
  )
}
