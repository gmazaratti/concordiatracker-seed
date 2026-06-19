import { useState } from 'react'
import type { CampusEvent } from '@/data/community'
import { useCommunity } from '@/features/community/useCommunity'
import { useFollows } from '@/app/providers/follows'
import { useAppData } from '@/app/providers/app-data'
import { OrgLogo } from '@/features/community/OrgLogo'
import { FollowButton } from '@/features/community/FollowButton'
import { EventTile } from '@/features/community/EventTile'
import { VerifiedBadge } from '@/features/community/VerifiedBadge'

/** The Community onboarding step, built from the REAL community components:
 * first follow an organizer (FollowButton), then add an event (EventTile →
 * addTask). Both optional — the whole step is skippable via the orchestrator. */
export function CommunityStep() {
  const { orgs, events } = useCommunity()
  const { isFollowing } = useFollows()
  const { addTask } = useAppData()
  const [showEvents, setShowEvents] = useState(false)
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set())
  const [now] = useState(() => Date.now())

  const someOrgs = orgs.filter((o) => o.verified).slice(0, 3)
  const followedAny = someOrgs.some((o) => isFollowing(o.handle))
  const eventsVisible = showEvents || followedAny

  const upcoming = [...events]
    .filter((e) => +new Date(e.start) > now)
    .sort((a, b) => +new Date(a.start) - +new Date(b.start))
    .slice(0, 3)

  const add = (e: CampusEvent) => {
    addTask({ title: e.title, due: e.start, note: `${e.org.name} · ${e.location}` })
    setAddedIds((prev) => new Set(prev).add(e.id))
  }

  return (
    <div className="mx-auto w-full max-w-xl">
      <h2 className="text-center font-display text-[21px] leading-tight font-semibold text-fg sm:text-[28px]">
        What's happening on campus
      </h2>
      <p className="mt-2 text-center text-[13px] leading-relaxed text-muted sm:text-[14px]">
        Follow an organizer to fill your feed, then add any event you're into — it drops onto your calendar.
      </p>

      <section className="mt-5 sm:mt-6">
        <h3 className="mb-2.5 text-[12px] font-semibold tracking-wide text-subtle uppercase">1 · Follow an organizer</h3>
        <ul className="space-y-2">
          {someOrgs.map((o) => (
            <li key={o.handle} className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3">
              <OrgLogo org={o} className="size-9" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1">
                  <span className="truncate text-[13px] font-semibold text-fg">{o.name}</span>
                  {o.verified && <VerifiedBadge />}
                </div>
                <span className="block truncate text-[12px] text-subtle">{o.handle}</span>
              </div>
              <FollowButton handle={o.handle} size="sm" />
            </li>
          ))}
        </ul>
      </section>

      {eventsVisible ? (
        <section className="mt-5 sm:mt-6">
          <h3 className="mb-2.5 text-[12px] font-semibold tracking-wide text-subtle uppercase">2 · Add an event you're into</h3>
          {upcoming.length === 0 ? (
            <p className="rounded-xl border border-border bg-surface px-4 py-6 text-center text-[13px] text-subtle">
              A quiet week on campus — check Community any time.
            </p>
          ) : (
            <div className="max-h-[34vh] space-y-2 overflow-y-auto sm:max-h-none">
              {upcoming.map((e) => (
                <EventTile
                  key={e.id}
                  event={e}
                  view="row"
                  relevant={false}
                  added={addedIds.has(e.id)}
                  onOpen={() => {}}
                  onAdd={() => add(e)}
                />
              ))}
            </div>
          )}
        </section>
      ) : (
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => setShowEvents(true)}
            className="text-[13px] font-medium text-muted transition-colors duration-150 hover:text-fg"
          >
            Skip — just show me events
          </button>
        </div>
      )}
    </div>
  )
}
