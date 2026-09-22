import { Link, useSearchParams } from 'react-router-dom'
import { usePeopleBadge } from '@/app/usePeopleBadge'
import {
  COMMUNITY_SECTIONS,
  DEFAULT_SECTION,
  communityHref,
  isCommunitySection,
  type CommunitySection,
} from '@/features/community/sections'
import { cn } from '@/lib/cn'

/**
 * Social's sections, nested under Social in the app sidebar.
 *
 * Same move the planner made, for the same reason: they were a strip across
 * the top of the page, which is a second navigation bar sitting under the
 * first one. The conversation pane is the part of this tab that wants the
 * height, and it was the part paying for that strip.
 *
 * Only rendered while you are ON Social, so four rows do not sit permanently
 * under a destination you are not in.
 */
export function SocialSubNav({ open }: { open: boolean }) {
  const [params] = useSearchParams()
  const waiting = usePeopleBadge()
  const raw = params.get('c')
  const active: CommunitySection = isCommunitySection(raw) ? raw : DEFAULT_SECTION

  return (
    // A grid whose single row animates 0fr -> 1fr: the CSS-only way to
    // transition to a height nobody has measured. `inert` while closed so the
    // links are not tabbable behind a collapsed section.
    <div
      className={cn(
        'grid transition-[grid-template-rows,opacity] duration-200 ease-out',
        open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
      )}
      inert={!open}
      aria-hidden={!open}
    >
      <div className="overflow-hidden">
        <div className="mt-0.5 mb-1 ml-[26px] border-l border-border pl-2">
          {COMMUNITY_SECTIONS.map((s) => {
            const on = active === s.id
            const badge = s.id === 'messages' ? waiting : 0
            return (
              <Link
                key={s.id}
                to={communityHref(s.id)}
                aria-current={on ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-2 rounded-md px-2 py-1.5 text-[12.5px] transition-colors duration-150',
                  on
                    ? 'bg-accent-soft font-medium text-fg'
                    : 'text-muted hover:bg-surface-2 hover:text-fg',
                )}
              >
                <s.icon
                  size={13}
                  aria-hidden
                  className={cn('shrink-0', on ? 'text-accent' : 'text-subtle')}
                />
                <span className="min-w-0 flex-1 truncate">{s.label}</span>
                {badge > 0 && (
                  <span className="shrink-0 rounded-full bg-accent px-1.5 text-[10px] font-semibold text-accent-contrast">
                    {badge}
                  </span>
                )}
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
