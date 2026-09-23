import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Bell, ChevronRight, Handshake, Inbox, ShieldCheck } from 'lucide-react'
import { SidePanel } from '@/components/SidePanel'
import { listNotifications, markNotificationsRead, type AppNotification } from '@/lib/notifications'
import { myOrgUnread } from '@/lib/org-messages'
import { isDemoOrgId } from '@/lib/demo-org'
import { cn } from '@/lib/cn'

/** The stored kinds that are about running a club. The rest (follows,
 *  feature requests) belong to the student app's panel. */
const ORG_KINDS = (k: string) => k === 'org_role' || k.startsWith('collab')

const WHEN = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
const nowIso = () => new Date().toISOString()

function demoItems(): AppNotification[] {
  const at = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString()
  return [
    { id: 'd1', kind: 'collab_invite', title: 'ConU Robotics invited you to collaborate', body: 'On their post "Build night recap".', link: '/organizer/collabs', subject_id: null, actor_name: 'ConU Robotics', read_at: null, created_at: at(3) },
    { id: 'd2', kind: 'org_role', title: 'HackConcordia: you are now Admin', body: 'Your role changed from Member to Admin.', link: '/organizer/roles', subject_id: null, actor_name: null, read_at: at(20), created_at: at(26) },
  ]
}

/**
 * The portal's bell.
 *
 * TWO SOURCES, ONE COUNT: stored notifications about running a club (a role
 * you were given, a collaboration invite) and unread messages in the club
 * inbox. Messages are counted rather than listed — the inbox is where you
 * read them — and the row says how many and takes you there.
 */
export function OrgBell({ orgId, className }: { orgId: string; className?: string }) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<AppNotification[] | null>(null)
  const [inbox, setInbox] = useState(0)
  const [tick, setTick] = useState(0)
  const demo = isDemoOrgId(orgId)

  useEffect(() => {
    let alive = true
    void (async () => {
      const [list, unread] = demo
        ? [demoItems(), { [orgId]: 2 } as Record<string, number>]
        : await Promise.all([listNotifications(), myOrgUnread()])
      if (!alive) return
      setItems(list.filter((n) => ORG_KINDS(n.kind)))
      setInbox(unread[orgId] ?? 0)
    })()
    return () => {
      alive = false
    }
  }, [orgId, demo, tick])

  // A glance at the badge should be current when you come back to the tab.
  useEffect(() => {
    const onVis = () => document.visibilityState === 'visible' && setTick((t) => t + 1)
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  const unread = (items?.filter((n) => !n.read_at).length ?? 0) + inbox

  const openPanel = useCallback(() => {
    setOpen(true)
    const ids = items?.filter((n) => !n.read_at).map((n) => n.id) ?? []
    if (ids.length === 0) return
    // Opening is reading: the dot clears now, the rows stay for this viewing.
    setItems((prev) => prev?.map((n) => (n.read_at ? n : { ...n, read_at: nowIso() })) ?? prev)
    if (!demo) void markNotificationsRead(ids)
  }, [items, demo])

  return (
    <>
      <button
        type="button"
        onClick={openPanel}
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        className={cn(
          'relative grid size-9 shrink-0 place-items-center rounded-lg text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg',
          className,
        )}
      >
        <Bell size={18} aria-hidden />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-danger px-1 text-[10.5px] font-bold text-white ring-2 ring-canvas">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && <OrgNotificationsPanel items={items ?? []} inbox={inbox} onClose={() => setOpen(false)} />}
    </>
  )
}

function OrgNotificationsPanel({
  items,
  inbox,
  onClose,
}: {
  items: AppNotification[]
  inbox: number
  onClose: () => void
}) {
  const navigate = useNavigate()
  return (
    <SidePanel label="Notifications" title="Notifications" onClose={onClose}>
      {(close) => {
        const go = (to: string) => {
          close()
          navigate(to)
        }
        return (
          <div className="flex flex-col gap-4 px-3 pt-1 pb-6 md:px-5">
            {inbox > 0 && (
              <button
                type="button"
                onClick={() => go('/organizer/inbox')}
                className="flex items-center gap-3 rounded-xl border border-accent/40 bg-accent-soft/40 px-3.5 py-3 text-left"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-accent-contrast">
                  <Inbox size={17} aria-hidden />
                </span>
                <span className="min-w-0 flex-1 text-[13.5px] font-medium text-fg">
                  {inbox} unread {inbox === 1 ? 'message' : 'messages'} in the club inbox
                </span>
                <ChevronRight size={16} className="text-subtle" aria-hidden />
              </button>
            )}

            {items.length === 0 && inbox === 0 ? (
              <p className="px-2 pt-6 text-center text-[13px] text-subtle">
                Nothing new. Role changes and collaboration invites for your club show up here.
              </p>
            ) : (
              <ul className="flex flex-col">
                {items.map((n) => {
                  const Icon = n.kind === 'org_role' ? ShieldCheck : Handshake
                  const body = (
                    <>
                      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-2 text-muted">
                        <Icon size={16} aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13.5px] font-medium text-fg">{n.title}</span>
                        {n.body && <span className="block text-[12.5px] leading-snug text-muted">{n.body}</span>}
                        <span className="mt-0.5 block text-[11.5px] text-subtle">{WHEN.format(new Date(n.created_at))}</span>
                      </span>
                      {!n.read_at && <span className="mt-2 size-2 shrink-0 rounded-full bg-accent" aria-label="Unread" />}
                    </>
                  )
                  return (
                    <li key={n.id}>
                      {n.link ? (
                        <button
                          type="button"
                          onClick={() => go(n.link!)}
                          className="flex w-full items-start gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-surface-2"
                        >
                          {body}
                        </button>
                      ) : (
                        <div className="flex items-start gap-3 px-2 py-2.5">{body}</div>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}

            <Link
              to="/app/community?activity=1"
              onClick={close}
              className="mt-2 px-2 text-[12.5px] font-medium text-accent hover:underline"
            >
              Your personal notifications are in the app
            </Link>
          </div>
        )
      }}
    </SidePanel>
  )
}
