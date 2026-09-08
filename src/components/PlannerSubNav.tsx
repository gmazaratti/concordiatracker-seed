import { Fragment } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useI18n } from '@/i18n/i18n'
import {
  PHASE_LABEL,
  PLANNER_TABS,
  PLANNER_TAB_IDS,
  plannerHref,
  type PlannerTab,
} from '@/features/planner/tabs'
import { cn } from '@/lib/cn'

/**
 * The planner's sections, nested under Planner in the app sidebar.
 *
 * They used to be a second vertical rail inside the page, which meant two
 * navigation columns on screen at once — and the schedule builder, the one
 * section that genuinely wants width, was the one paying for it. Nesting them
 * here says the same thing (a sequence, with its phases named) in space the
 * sidebar already occupies.
 *
 * Only rendered while you are ON the planner. A permanently expanded nine-item
 * subtree would make Planner look like the centre of the app, which it is not —
 * Today is.
 */
export function PlannerSubNav() {
  const { t } = useI18n()
  const [params] = useSearchParams()
  const fromUrl = params.get('tab')
  const active: PlannerTab =
    fromUrl && PLANNER_TAB_IDS.has(fromUrl) ? (fromUrl as PlannerTab) : 'record'

  return (
    <div className="mt-0.5 mb-1 ml-[26px] border-l border-border pl-2">
      {PLANNER_TABS.map((item, i) => {
        const Icon = item.icon
        const on = active === item.id
        const startsPhase = i === 0 || PLANNER_TABS[i - 1].phase !== item.phase
        return (
          <Fragment key={item.id}>
            {startsPhase && (
              <p
                className={cn(
                  'px-2 text-[10px] font-semibold tracking-wide text-subtle uppercase',
                  i === 0 ? 'pb-1' : 'pt-2.5 pb-1',
                )}
              >
                {PHASE_LABEL[item.phase]}
              </p>
            )}
            <Link
              to={plannerHref(item.id)}
              aria-current={on ? 'page' : undefined}
              className={cn(
                'flex items-center gap-2 rounded-md px-2 py-1.5 text-[12.5px] transition-colors duration-150',
                on
                  ? 'bg-accent-soft font-medium text-fg'
                  : 'text-muted hover:bg-surface-2 hover:text-fg',
              )}
            >
              <Icon
                size={13}
                aria-hidden
                className={cn('shrink-0', on ? 'text-accent' : 'text-subtle')}
              />
              <span className="min-w-0 truncate">{t(item.labelKey)}</span>
            </Link>
          </Fragment>
        )
      })}
    </div>
  )
}
