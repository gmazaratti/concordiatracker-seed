import { Fragment } from 'react'

import type { LucideIcon } from 'lucide-react'
import { Select } from '@/components/ui/Select'
import { cn } from '@/lib/cn'
import type { PlannerNav } from './nav-layout'

export type Phase = 'know' | 'explore' | 'commit'

export interface NavItem<T extends string> {
  id: T
  label: string
  icon: LucideIcon
  phase: Phase
}

/** Phase headings, used by the rail — the only layout with room for them. */
const PHASE_LABEL: Record<Phase, string> = {
  know: 'What you have done',
  explore: 'What you could take',
  commit: 'What you are taking',
}

/**
 * The planner's section switcher, in whichever shape is being trialled.
 *
 * One component rather than four scattered through the page, so the four
 * layouts cannot drift apart in what they can express — every one of them
 * shows the same six sections in the same order with the same phase grouping,
 * and only the arrangement differs.
 */
export function PlannerNavBar<T extends string>({
  layout,
  items,
  active,
  onChange,
}: {
  layout: PlannerNav
  items: NavItem<T>[]
  active: T
  onChange: (id: T) => void
}) {
  if (layout === 'menu') {
    return (
      <div className="mb-5 print:hidden">
        <Select
          value={active}
          // Select speaks plain strings; the ids are a narrower union, and the
          // value can only ever be one of the options we just handed it.
          onChange={(v) => onChange(v as T)}
          ariaLabel="Planner section"
          options={items.map((i) => ({ value: i.id, label: i.label }))}
        />
      </div>
    )
  }

  if (layout === 'pills') {
    return (
      <div
        role="tablist"
        aria-label="Planner sections"
        className="mx-auto mb-5 flex w-fit max-w-full gap-0.5 overflow-x-auto rounded-xl border border-border bg-surface p-1 print:hidden"
      >
        {items.map((item) => {
          const Icon = item.icon
          const on = active === item.id
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => onChange(item.id)}
              className={cn(
                'inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-medium whitespace-nowrap transition-colors duration-150',
                on ? 'bg-accent-soft text-fg' : 'text-muted hover:bg-surface-2 hover:text-fg',
              )}
            >
              <Icon size={13} aria-hidden className={cn('shrink-0', on && 'text-accent')} />
              {item.label}
            </button>
          )
        })}
      </div>
    )
  }

  if (layout === 'rail') {
    return (
      <nav
        role="tablist"
        aria-label="Planner sections"
        aria-orientation="vertical"
        className="mb-4 flex gap-1 overflow-x-auto lg:mb-0 lg:w-[190px] lg:shrink-0 lg:flex-col lg:gap-0 lg:overflow-visible print:hidden"
      >
        {items.map((item, i) => {
          const Icon = item.icon
          const on = active === item.id
          const startsPhase = i === 0 || items[i - 1].phase !== item.phase
          return (
            <Fragment key={item.id}>
              {/* Only the rail has the vertical room to name the phases rather
                  than imply them with a hairline. */}
              {startsPhase && (
                <p
                  className={cn(
                    'hidden px-3 text-[10.5px] font-semibold tracking-wide text-subtle uppercase lg:block',
                    i === 0 ? 'pb-1.5' : 'pt-4 pb-1.5',
                  )}
                >
                  {PHASE_LABEL[item.phase]}
                </p>
              )}
              <button
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => onChange(item.id)}
                className={cn(
                  'inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium whitespace-nowrap transition-colors duration-150 lg:w-full',
                  on ? 'bg-accent-soft text-fg' : 'text-muted hover:bg-surface-2 hover:text-fg',
                )}
              >
                <Icon size={14} aria-hidden className={cn('shrink-0', on && 'text-accent')} />
                {item.label}
              </button>
            </Fragment>
          )
        })}
      </nav>
    )
  }

  // 'top' — the strip this started as.
  return (
    <div
      role="tablist"
      aria-label="Planner sections"
      className="mb-5 grid grid-cols-3 gap-1 border-b border-border sm:flex sm:gap-1 print:hidden"
    >
      {items.map((item, i) => {
        const Icon = item.icon
        const on = active === item.id
        const startsPhase = i > 0 && items[i - 1].phase !== item.phase
        return (
          <Fragment key={item.id}>
            {startsPhase && (
              <span
                className="mx-1.5 hidden self-center sm:block sm:h-4 sm:w-px sm:bg-border"
                aria-hidden
              />
            )}
            <button
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => onChange(item.id)}
              className={cn(
                'inline-flex items-center justify-center gap-1.5 border-b-2 px-2 py-2.5 text-[12px] font-medium transition-colors duration-150 sm:shrink-0 sm:justify-start sm:px-3 sm:text-[13px] sm:whitespace-nowrap',
                on ? 'border-accent text-fg' : 'border-transparent text-muted hover:text-fg',
              )}
            >
              <Icon size={14} aria-hidden className="shrink-0" />
              <span className="truncate">{item.label}</span>
            </button>
          </Fragment>
        )
      })}
    </div>
  )
}
