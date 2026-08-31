import { Fragment } from 'react'
import { Select } from '@/components/ui/Select'

import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'

export type Phase = 'know' | 'explore' | 'commit'

export interface NavItem<T extends string> {
  id: T
  label: string
  icon: LucideIcon
  phase: Phase
}

/** Phase headings. The rail has the vertical room to name the phases outright,
 *  which is most of why it won: the sections read as a sequence you move
 *  through rather than six unrelated tabs. */
const PHASE_LABEL: Record<Phase, string> = {
  know: 'What you have done',
  explore: 'What you could take',
  commit: 'What you are taking',
}

/**
 * The planner's section switcher.
 *
 * Four arrangements were trialled side by side on the real screens; this is the
 * one that stayed. It reads as a place you are IN rather than a page you
 * switched to, and it is the only shape with room to name the phases — know,
 * explore, commit — which is what turns six sections into one sequence.
 *
 * Below `lg` it is a SELECT, not a scrolling strip. The strip was the obvious
 * translation of a rail to a narrow screen and it was wrong: eight sections in
 * three phases means most of them are off-screen at any moment, so you cannot
 * see where you are in the sequence, cannot see what else there is, and have to
 * swipe a row of tabs to find out — inside a page that already scrolls. A
 * closed control that names the current section answers "where am I" in one
 * line and opens to the full list.
 */
export function PlannerNavBar<T extends string>({
  items,
  active,
  onChange,
}: {
  items: NavItem<T>[]
  active: T
  onChange: (id: T) => void
}) {
  return (
    <>
      {/* Phones. One line that says where you are; tapping shows everything. */}
      <div className="mb-4 lg:hidden">
        <Select
          value={active}
          onChange={(v) => onChange(v as T)}
          ariaLabel="Planner section"
          options={items.map((i) => ({ value: i.id, label: i.label }))}
        />
      </div>

    <nav
      role="tablist"
      aria-label="Planner sections"
      aria-orientation="vertical"
      className="hidden lg:mb-0 lg:flex lg:w-[190px] lg:shrink-0 lg:flex-col lg:gap-0 print:hidden"
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
    </>
  )
}
