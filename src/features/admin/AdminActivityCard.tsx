import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Bell,
  Bug,
  Building2,
  ChevronDown,
  GraduationCap,
  Inbox,
  Lightbulb,
  UserPlus,
  type LucideIcon,
} from 'lucide-react'
import {
  adminActivityFeed,
  adminMarkActivitySeen,
  countUnseen,
  fmtDateTime,
  useIsAdmin,
  type ActivityFeed,
  type ActivityKind,
} from './admin-data'
import { cn } from '@/lib/cn'

const KIND: Record<ActivityKind, { icon: LucideIcon; href: string; tint: string }> = {
  user: { icon: UserPlus, href: '/admin?tab=users', tint: 'text-info' },
  feature: { icon: Lightbulb, href: '/feedback', tint: 'text-accent' },
  bug: { icon: Bug, href: '/admin?tab=bugs', tint: 'text-warning' },
  request: { icon: Inbox, href: '/admin?tab=applications', tint: 'text-info' },
  org: { icon: Building2, href: '/admin?tab=applications', tint: 'text-accent' },
  teacher: { icon: GraduationCap, href: '/admin?tab=applications', tint: 'text-accent' },
}

/**
 * Admin-only "activity inbox" at the top of Today: new users, feedback, feature
 * requests, and pending applications, newest first, with an unseen badge.
 * Renders nothing for non-admins. Opening it marks everything seen (server-side),
 * but the items that were new stay subtly flagged in that session.
 */
export function AdminActivityCard() {
  const { isAdmin } = useIsAdmin()
  const [feed, setFeed] = useState<ActivityFeed | null>(null)
  const [open, setOpen] = useState(false)
  const [cleared, setCleared] = useState(false)

  useEffect(() => {
    if (!isAdmin) return
    let active = true
    void adminActivityFeed()
      .then((f) => active && setFeed(f))
      .catch(() => {})
    return () => {
      active = false
    }
  }, [isAdmin])

  if (!isAdmin || !feed || feed.items.length === 0) return null

  const baseSeenMs = feed.seenAt ? new Date(feed.seenAt).getTime() : 0
  const unseen = cleared ? 0 : countUnseen(feed.items, baseSeenMs)

  function toggle() {
    const next = !open
    setOpen(next)
    if (next && !cleared && unseen > 0) {
      void adminMarkActivitySeen().catch(() => {})
      setCleared(true)
    }
  }

  return (
    <section
      className={cn(
        'mb-4 overflow-hidden rounded-xl border bg-surface',
        unseen > 0 ? 'border-accent/40' : 'border-border',
      )}
    >
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-150 hover:bg-surface-2/40"
      >
        <span
          className={cn(
            'grid size-8 shrink-0 place-items-center rounded-lg',
            unseen > 0 ? 'bg-accent-soft text-accent' : 'bg-surface-2 text-subtle',
          )}
        >
          <Bell size={16} aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-semibold text-fg">Activity</span>
          <span className="block truncate text-[12px] text-subtle">
            {unseen > 0 ? `${unseen} new since you last looked` : 'You’re all caught up'}
          </span>
        </span>
        {unseen > 0 && (
          <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold text-accent-contrast tabular-nums">
            {unseen}
          </span>
        )}
        <ChevronDown
          size={16}
          className={cn('shrink-0 text-subtle transition-transform duration-150', open && 'rotate-180')}
          aria-hidden
        />
      </button>

      {open && (
        <ul className="max-h-[22rem] divide-y divide-border overflow-y-auto border-t border-border">
          {feed.items.map((item) => {
            const meta = KIND[item.kind]
            const Icon = meta.icon
            const isNew = new Date(item.created_at).getTime() > baseSeenMs
            return (
              <li key={`${item.kind}-${item.id}`}>
                <Link
                  to={meta.href}
                  className="flex items-start gap-3 px-4 py-2.5 transition-colors duration-150 hover:bg-surface-2/40"
                >
                  <Icon size={15} className={cn('mt-0.5 shrink-0', meta.tint)} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-[13px] font-medium text-fg">{item.title}</span>
                      {isNew && <span className="size-1.5 shrink-0 rounded-full bg-accent" aria-label="new" />}
                    </span>
                    <span className="block truncate text-[12px] text-subtle">{item.subtitle}</span>
                  </span>
                  <span className="shrink-0 text-[11px] whitespace-nowrap text-subtle">
                    {fmtDateTime(item.created_at)}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
