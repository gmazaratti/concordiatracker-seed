import { Link } from 'react-router-dom'
import { Bell, CalendarDays, MessageSquare, Tag, UserPlus, type LucideIcon } from 'lucide-react'
import { useActivityFeed, type ActivityItem } from '@/features/community/useActivityFeed'
import { relativeDueLabel } from '@/lib/date'
import { WidgetCard, WidgetEmpty } from './WidgetCard'
import { cn } from '@/lib/cn'

/**
 * News on Today, in the shape of the admin activity card.
 *
 * WHY A WIDGET AND NOT A BELL IN THE HEADER. Today has no chrome to hang one
 * off — the header is a date and a greeting, and bolting an icon onto it
 * would be the first piece of furniture on a screen that has deliberately
 * never had any. As a widget it gets a home the student picks, in the rail or
 * the wide column, and anybody who does not want an inbox on Today simply
 * does not add it. That is the whole point of the registry.
 *
 * It is a SUMMARY. Four lines and a way through to the full panel; the panel
 * is where you read and clear things. A widget that tried to be the inbox
 * would be a second due list, which is the one thing Today must never grow.
 */
const FACE: Record<ActivityItem['kind'], { icon: LucideIcon; tint: string }> = {
  event: { icon: CalendarDays, tint: 'text-info' },
  request: { icon: UserPlus, tint: 'text-accent' },
  accepted: { icon: UserPlus, tint: 'text-success' },
  stored: { icon: Tag, tint: 'text-accent' },
  messages: { icon: MessageSquare, tint: 'text-accent' },
}

function line(item: ActivityItem): { title: string; sub: string; href: string } {
  switch (item.kind) {
    case 'event':
      return { title: item.title, sub: item.sub, href: item.href }
    case 'request':
      return {
        title: `${item.friend.name ?? 'Someone'} wants to connect`,
        sub: 'Connection request',
        href: '/app/community?c=messages',
      }
    case 'accepted':
      return {
        title: `You and ${item.friend.name ?? 'someone'} are connected`,
        sub: 'Connection',
        href: '/app/community?c=messages',
      }
    case 'messages':
      return {
        title: item.count === 1 ? '1 unread message' : `${item.count} unread messages`,
        sub: 'Messages',
        href: '/app/community?c=messages',
      }
    case 'stored':
      return {
        title: item.n.title,
        sub: item.n.kind === 'follow' ? 'New follower' : 'Feature request',
        href: item.n.link ?? '/app/community?activity=1',
      }
  }
}

export function ActivityWidget({ zone }: { zone?: 'rail' | 'wide' | 'half' }) {
  const { items, unread, loading } = useActivityFeed()
  const shown = items.slice(0, zone === 'rail' ? 3 : 4)

  return (
    <WidgetCard
      title="Activity"
      icon={Bell}
      action={
        unread > 0 ? (
          <span className="rounded-full bg-accent px-1.5 text-[10.5px] font-semibold text-accent-contrast tabular-nums">
            {unread}
          </span>
        ) : undefined
      }
    >
      {loading && items.length === 0 ? (
        <WidgetEmpty>Checking…</WidgetEmpty>
      ) : shown.length === 0 ? (
        <WidgetEmpty>
          Nothing new. Replies, follows and connection requests land here.
        </WidgetEmpty>
      ) : (
        <>
          <ul className="divide-y divide-border/60">
            {shown.map((item) => {
              const { title, sub, href } = line(item)
              const face = FACE[item.kind]
              const Icon = face.icon
              const isNew = item.kind === 'stored' && !item.n.read_at
              return (
                <li key={item.id}>
                  <Link
                    to={href}
                    className="flex items-start gap-2.5 px-3.5 py-2 transition-colors duration-150 hover:bg-surface-2/50"
                  >
                    <Icon size={14} className={cn('mt-0.5 shrink-0', face.tint)} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="min-w-0 flex-1 truncate text-[12.5px] text-fg">
                          {title}
                        </span>
                        {isNew && (
                          <span
                            className="size-1.5 shrink-0 rounded-full bg-accent"
                            aria-label="new"
                          />
                        )}
                      </span>
                      <span className="block truncate text-[11px] text-subtle">
                        {sub} · {relativeDueLabel(new Date(item.at).toISOString())}
                      </span>
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
          <Link
            to="/app/community?activity=1"
            className="block border-t border-border/60 px-3.5 py-2 text-[12px] font-medium text-accent transition-colors duration-150 hover:bg-surface-2/50"
          >
            See all activity
          </Link>
        </>
      )}
    </WidgetCard>
  )
}
