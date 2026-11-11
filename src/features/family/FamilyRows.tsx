import { useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import type { Assessment, Course } from '@/data/types'
import { courseColor } from '@/lib/course-color'
import { percentToGrade } from '@/lib/gpa'
import { gradeToPercent } from '@/lib/grade'
import { isOpen } from '@/lib/status'
import { KIND_LABEL } from '@/lib/assessment'
import { cn } from '@/lib/cn'
import { dueLabel, splitTitle } from './family-format'


/**
 * A due-list section, rows shaped like Today's but read-only. Long sections
 * show the first `limit` and fold the rest behind "Show N more", so eight
 * past-due quizzes do not push everything else off the screen.
 */
export function Group({
  label,
  hint,
  tone,
  items,
  course,
  grades,
  now,
  limit = 5,
}: {
  label: string
  /** A quiet line under the heading (what "past due" means, say). */
  hint?: string
  tone?: 'danger'
  items: Assessment[]
  course: (id: string) => Course | undefined
  grades: boolean
  now: number
  limit?: number
}) {
  const [all, setAll] = useState(false)
  if (items.length === 0) return null
  const shown = all ? items : items.slice(0, limit)
  const hidden = items.length - shown.length
  return (
    <div className="border-b border-border/60 last:border-0">
      <div className="flex items-baseline gap-2 px-4 pt-3.5 pb-1.5">
        <p className={cn('text-[11px] font-semibold tracking-wide uppercase', tone === 'danger' ? 'text-danger' : 'text-subtle')}>{label}</p>
        <p className="text-[11px] text-subtle">{items.length}</p>
        {hint && <p className="ml-auto truncate text-[11px] text-subtle">{hint}</p>}
      </div>
      <ul>
        {shown.map((a) => (
          <Row key={a.id} a={a} c={course(a.courseId)} grades={grades} now={now} />
        ))}
      </ul>
      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setAll(true)}
          className="flex w-full items-center gap-1.5 px-4 pt-1 pb-3 text-left text-[12.5px] font-medium text-muted transition-colors duration-150 hover:text-fg"
        >
          <ChevronDown size={14} aria-hidden /> Show {hidden} more
        </button>
      )}
    </div>
  )
}

function Row({ a, c, grades, now }: { a: Assessment; c: Course | undefined; grades: boolean; now: number }) {
  const { name, note } = splitTitle(a.title)
  const due = dueLabel(a.due, now)
  const pct = grades ? gradeToPercent(a.grade) : null
  const done = !isOpen(a.status)
  return (
    <li className="flex items-start gap-3 px-4 py-2.5">
      <span
        className={cn('mt-0.5 grid size-[18px] shrink-0 place-items-center rounded-full border-2', done ? 'border-accent bg-accent text-accent-contrast' : 'border-border-strong')}
        aria-hidden
      >
        {done && <Check size={10} strokeWidth={3.5} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn('block truncate text-[14px] font-medium', done ? 'text-subtle line-through' : 'text-fg')}>{name}</span>
        <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[12px] text-subtle">
          {c && <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: courseColor(c.color).hex }} aria-hidden />}
          <span className="shrink-0">
            {c?.code} · {KIND_LABEL[a.kind]} · {a.weight}%
          </span>
          {note && <span className="min-w-0 truncate">· {note}</span>}
        </span>
      </span>
      {pct !== null ? (
        <span className="shrink-0 pt-0.5 text-[13px] font-semibold whitespace-nowrap text-fg">
          {Math.round(pct)}% {percentToGrade(pct).letter}
        </span>
      ) : (
        <span
          className={cn(
            'shrink-0 pt-0.5 text-[13px] font-semibold whitespace-nowrap',
            due.tone === 'late' ? 'text-danger' : due.tone === 'soon' ? 'text-warning' : 'text-fg',
          )}
        >
          {due.text}
        </span>
      )}
    </li>
  )
}
