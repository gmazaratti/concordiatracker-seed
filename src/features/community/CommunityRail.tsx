import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, UserPlus } from 'lucide-react'
import { useFollows } from '@/app/providers/follows'
import { useCommunity } from './useCommunity'
import { useEventActions } from './useEventActions'
import { OrgLogo } from './OrgLogo'
import { VerifiedBadge } from './VerifiedBadge'
import { FollowButton } from './FollowButton'
import { orgSlug, type CampusEvent, type EventOrg } from '@/data/community'
import { useFollowedPeople, type PublicPerson } from './profile-follows'
import { PersonAvatar } from './CommunitySearch'
import { cn } from '@/lib/cn'

const DAY = 86_400_000

/* Clock reads live in module helpers rather than inline in the component: the
 * render path has to stay pure, and this keeps the selection logic testable. */

/** Upcoming events inside the next 7 days, soonest first. */
function eventsThisWeek(events: CampusEvent[], limit = 5): CampusEvent[] {
  const now = Date.now()
  return events
    .filter((e) => {
      const t = new Date(e.start).getTime()
      return t >= now && t <= now + 7 * DAY
    })
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
    .slice(0, limit)
}

/** Orgs the student doesn't follow yet, ranked by upcoming activity — a dead
 * org is a poor suggestion, so only ones with something coming up qualify. */
function suggestOrgs(
  orgs: EventOrg[],
  events: CampusEvent[],
  isFollowing: (handle: string) => boolean,
  limit = 4,
): EventOrg[] {
  const now = Date.now()
  const upcoming = new Map<string, number>()
  for (const e of events) {
    if (new Date(e.start).getTime() < now) continue
    upcoming.set(e.org.handle, (upcoming.get(e.org.handle) ?? 0) + 1)
  }
  return orgs
    .filter((o) => !isFollowing(o.handle) && (upcoming.get(o.handle) ?? 0) > 0)
    .sort((a, b) => (upcoming.get(b.handle) ?? 0) - (upcoming.get(a.handle) ?? 0))
    .slice(0, limit)
}

/**
 * Desktop-only right rail for Community.
 *
 * This does NOT add social features — it gives the ones that already exist a
 * proper home. Following and notifications were crammed into header popovers,
 * which is why the Following list felt odd; here they're plain lists with room
 * to breathe. Everything shown is real data, so nothing is a placeholder.
 *
 * Hidden below xl: the events grid needs the width more than the rail does.
 */
export function CommunityRail() {
  const { orgs, events } = useCommunity()
  const { openEvent } = useEventActions()
  const { followedHandles, isFollowing } = useFollows()
  const { people } = useFollowedPeople()

  const thisWeek = useMemo(() => eventsThisWeek(events), [events])

  const suggestions = useMemo(
    () => suggestOrgs(orgs, events, isFollowing),
    [orgs, events, isFollowing],
  )

  const following = useMemo(
    () => orgs.filter((o) => followedHandles.includes(o.handle)),
    [orgs, followedHandles],
  )

  return (
    <aside className="hidden w-[300px] shrink-0 xl:block">
      <div className="sticky top-5 flex flex-col gap-4">
        {thisWeek.length > 0 && (
          <Panel title="Happening this week" icon={CalendarDays}>
            <ul className="divide-y divide-border">
              {thisWeek.map((e) => (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => openEvent(e.id)}
                    className="flex w-full items-start gap-2.5 px-3.5 py-2.5 text-left transition-colors hover:bg-surface-2/50"
                  >
                    <OrgLogo org={e.org} className="mt-0.5 size-7" rounded="rounded-lg" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] font-medium text-fg">{e.title}</span>
                      <span className="block truncate text-[11px] text-subtle">
                        {e.org.name} · {whenLabel(e)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </Panel>
        )}

        {suggestions.length > 0 && (
          <Panel title="Orgs to follow" icon={UserPlus}>
            <ul className="divide-y divide-border">
              {suggestions.map((o) => (
                <OrgRow key={o.handle} org={o} />
              ))}
            </ul>
          </Panel>
        )}

        {(following.length > 0 || people.length > 0) && (
          <FollowingPanel orgs={following} people={people} />
        )}
      </div>
    </aside>
  )
}

function OrgRow({ org }: { org: EventOrg }) {
  return (
    <li className="flex items-center gap-2.5 px-3.5 py-2.5">
      <Link to={`/app/community/org/${orgSlug(org)}`} className="flex min-w-0 flex-1 items-center gap-2.5">
        <OrgLogo org={org} className="size-8" rounded="rounded-lg" />
        <span className="min-w-0">
          <span className="flex items-center gap-1">
            <span className="truncate text-[12.5px] font-medium text-fg">{org.name}</span>
            {org.verified && <VerifiedBadge size={12} />}
          </span>
          <span className="block truncate text-[11px] text-subtle">{org.handle}</span>
        </span>
      </Link>
      <FollowButton handle={org.handle} size="sm" />
    </li>
  )
}

function Panel({
  title,
  icon: Icon,
  children,
}: {
  title: string
  icon?: typeof CalendarDays
  children: React.ReactNode
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-surface">
      <h2 className="flex items-center gap-1.5 border-b border-border px-3.5 py-2.5 text-[12.5px] font-semibold text-fg">
        {Icon && <Icon size={14} className="text-subtle" aria-hidden />}
        {title}
      </h2>
      {children}
    </section>
  )
}

/** "Tomorrow · 6:00 PM" — short enough for a 300px rail. */
function whenLabel(e: CampusEvent): string {
  const d = new Date(e.start)
  const days = Math.round((d.getTime() - Date.now()) / DAY)
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  const day = days <= 0 ? 'Today' : days === 1 ? 'Tomorrow' : d.toLocaleDateString(undefined, { weekday: 'short' })
  return `${day} · ${time}`
}


/** How many rows before the list collapses behind "View all". */
const FOLLOW_PREVIEW = 5

/**
 * Following, split by type. Orgs and people are genuinely different things —
 * one is an account you get events from, the other is a student whose outlines
 * you might import — so they get tabs rather than one blended list.
 */
function FollowingPanel({ orgs, people }: { orgs: EventOrg[]; people: PublicPerson[] }) {
  const [tab, setTab] = useState<'orgs' | 'people'>(orgs.length >= people.length ? 'orgs' : 'people')
  const [expanded, setExpanded] = useState(false)

  const rows = tab === 'orgs' ? orgs : people
  const shown = expanded ? rows : rows.slice(0, FOLLOW_PREVIEW)
  const hidden = rows.length - shown.length

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-surface">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3.5 py-2.5">
        <h2 className="text-[12.5px] font-semibold text-fg">Following</h2>
        <div className="flex gap-0.5 rounded-lg bg-surface-2 p-0.5">
          {(['orgs', 'people'] as const).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={tab === k}
              onClick={() => {
                setTab(k)
                setExpanded(false)
              }}
              className={cn(
                'rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors duration-150',
                tab === k ? 'bg-surface text-fg' : 'text-subtle hover:text-fg',
              )}
            >
              {k === 'orgs' ? 'Orgs' : 'People'} {k === 'orgs' ? orgs.length : people.length}
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="px-3.5 py-4 text-center text-[12px] text-subtle">
          {tab === 'orgs' ? 'No organizations yet.' : 'No people yet: search to find classmates.'}
        </p>
      ) : (
        <>
          <ul className="divide-y divide-border">
            {tab === 'orgs'
              ? (shown as EventOrg[]).map((o) => <OrgRow key={o.handle} org={o} />)
              : (shown as PublicPerson[]).map((p) => <PersonRow key={p.handle} person={p} />)}
          </ul>
          {(hidden > 0 || expanded) && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="w-full border-t border-border px-3.5 py-2 text-[12px] font-medium text-accent transition-colors hover:bg-surface-2/50"
            >
              {expanded ? 'Show less' : `View all ${rows.length}`}
            </button>
          )}
        </>
      )}
    </section>
  )
}

function PersonRow({ person }: { person: PublicPerson }) {
  return (
    <li>
      <Link
        to={`/@${person.handle}`}
        className="flex items-center gap-2.5 px-3.5 py-2.5 transition-colors hover:bg-surface-2/50"
      >
        <PersonAvatar person={person} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12.5px] font-medium text-fg">
            {person.name || `@${person.handle}`}
          </span>
          <span className="block truncate text-[11px] text-subtle">
            @{person.handle}
            {person.follower_count > 0 && ` · ${person.follower_count} follower${person.follower_count === 1 ? '' : 's'}`}
          </span>
        </span>
      </Link>
    </li>
  )
}
