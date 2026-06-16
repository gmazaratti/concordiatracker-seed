import { Lock } from 'lucide-react'
import { useAppData } from '@/app/providers/app-data'
import type { Plan } from '@/data/types'
import { cn } from '@/lib/cn'
import { Group } from '../controls'

type Meter = {
  key: string
  label: string
  description: string
  used: number
  /** A number cap, or 'unlimited'. Ignored when `locked`. */
  limit: number | 'unlimited'
  /** Gated to the Semester pass (shown locked on free). */
  locked?: boolean
}

/** The meter list is intentionally data-driven so new plan-limited features slot
 * in by adding a row here — nothing else changes. */
function buildMeters(plan: Plan, courseCount: number): Meter[] {
  const semester = plan === 'semester'
  return [
    {
      key: 'scans',
      label: 'Syllabus scans',
      description: 'Resets on the 1st of each month.',
      used: 1,
      limit: semester ? 'unlimited' : 3,
    },
    {
      key: 'blueprints',
      label: 'Blueprint imports',
      description: 'Contribute an outline to earn theme credits.',
      used: 0,
      limit: semester ? 'unlimited' : 1,
    },
    {
      key: 'gpa',
      label: 'GPA projections',
      description: 'Predict where your grade lands across what-ifs.',
      used: 0,
      limit: semester ? 'unlimited' : 0,
      locked: !semester,
    },
    {
      key: 'courses',
      label: 'Courses tracked',
      description: 'No cap on the classes you follow.',
      used: courseCount,
      limit: 'unlimited',
    },
  ]
}

export function UsageSection() {
  const { plan, courses } = useAppData()
  const meters = buildMeters(plan, courses.length)
  const semester = plan === 'semester'

  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-2/25 px-4 py-3">
        <p className="text-[13px] text-muted">
          You&rsquo;re on the{' '}
          <span className="font-semibold text-fg">
            {semester ? 'Semester pass' : 'Free plan'}
          </span>
          .
        </p>
        <span
          className={
            semester
              ? 'rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-success uppercase'
              : 'rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-subtle uppercase'
          }
        >
          {semester ? 'Unlimited' : 'Limited'}
        </span>
      </div>

      <Group label="This month">
        {meters.map((m) => (
          <MeterRow key={m.key} meter={m} />
        ))}
      </Group>
    </div>
  )
}

function MeterRow({ meter }: { meter: Meter }) {
  const { label, description, used, limit, locked } = meter
  const numeric = !locked && typeof limit === 'number'
  const pct = numeric ? Math.min(100, limit === 0 ? 0 : (used / (limit as number)) * 100) : 0
  const atLimit = numeric && used >= (limit as number)

  return (
    <div className="px-4 py-3.5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] font-medium text-fg">{label}</p>
        {locked ? (
          <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-subtle">
            <Lock size={12} aria-hidden />
            Semester only
          </span>
        ) : limit === 'unlimited' ? (
          <span className="text-[12px] font-medium text-success">Unlimited</span>
        ) : (
          <span className={cn('text-[12px] font-medium tabular-nums', atLimit ? 'text-warning' : 'text-muted')}>
            {used} / {limit}
          </span>
        )}
      </div>

      {numeric && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
          <div
            className={cn('h-full rounded-full', atLimit ? 'bg-warning' : 'bg-accent')}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      <p className="mt-1.5 text-[12px] text-subtle">{description}</p>
    </div>
  )
}
