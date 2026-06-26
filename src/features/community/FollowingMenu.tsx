import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Users } from 'lucide-react'
import { useFollows } from '@/app/providers/follows'
import { orgSlug } from '@/data/community'
import { OrgLogo } from './OrgLogo'
import { VerifiedBadge } from './VerifiedBadge'
import { FollowButton } from './FollowButton'
import { useCommunity } from './useCommunity'

/** The orgs you follow, as a scrollable LIST behind a "Following N" button —
 * replaces the pinned chip bar (which got cluttered with many follows). Each row
 * links to the profile and can be unfollowed inline. Same popover pattern as the
 * notifications bell, so it works identically on mobile. */
export function FollowingMenu() {
  const { followedHandles } = useFollows()
  const { orgByHandle } = useCommunity()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const orgs = followedHandles.map((h) => orgByHandle(h)).filter((o) => o !== undefined)

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        data-tour="following"
        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 text-[13px] font-medium text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
      >
        <Users size={16} aria-hidden />
        <span className="hidden sm:inline">Following</span>
        <span className="rounded bg-surface-2 px-1.5 text-[11px] tabular-nums">{orgs.length}</span>
      </button>

      {open && (
        <div
          role="menu"
          className="ct-animate-pop absolute right-0 z-30 mt-1 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-surface p-1.5 shadow-2xl"
        >
          <div className="px-2 py-1.5 text-[13px] font-semibold text-fg">Following</div>

          {orgs.length === 0 ? (
            <p className="px-2 py-6 text-center text-[12px] text-subtle">
              You're not following any organizations yet. Use search to find some.
            </p>
          ) : (
            <ul className="max-h-80 overflow-y-auto">
              {orgs.map((org) => (
                <li
                  key={org.handle}
                  className="flex items-center gap-2 rounded-lg px-1.5 py-1.5 transition-colors duration-150 hover:bg-surface-2"
                >
                  <Link
                    to={`/app/community/org/${orgSlug(org)}`}
                    onClick={() => setOpen(false)}
                    className="flex min-w-0 flex-1 items-center gap-2.5"
                  >
                    <OrgLogo org={org} className="size-8" rounded="rounded-md" textClass="text-[11px]" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1 text-[13px] font-medium text-fg">
                        <span className="truncate">{org.name}</span>
                        {org.verified && <VerifiedBadge size={12} />}
                      </span>
                      <span className="block truncate text-[12px] text-subtle">{org.handle}</span>
                    </span>
                  </Link>
                  <FollowButton handle={org.handle} size="sm" className="shrink-0" />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
