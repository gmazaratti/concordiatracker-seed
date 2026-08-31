import { useNavigate } from 'react-router-dom'
import { useFollows } from '@/app/providers/follows'
import { postedAgoLabel } from '@/data/community'
import { startOfToday } from '@/lib/date'
import { Mascot } from '@/components/Mascot'
import { OrgLogo } from './OrgLogo'
import { useCommunity } from './useCommunity'
import { CommunitySubPage } from './CommunitySubPage'

/**
 * Notifications, as a page.
 *
 * Still a UI SHELL — items are derived from the orgs you follow, and real
 * generation and delivery need a multi-user backend (CONNECTION-PHASE). What
 * changed is the container: a list of things that each open something else does
 * not belong in a popover that closes when you look away, and on a phone the
 * popover was most of the screen anyway without any of a page's benefits.
 *
 * Opening an event navigates back to the feed with `?event=`, which is the same
 * URL the feed uses for its overlay — so the back button lands where you expect
 * instead of on a blank list.
 */
export function NotificationsPage() {
  const { followedHandles } = useFollows()
  const { recentEventsFromOrgs } = useCommunity()
  const navigate = useNavigate()
  const items = recentEventsFromOrgs(followedHandles, startOfToday())

  return (
    <CommunitySubPage title="Notifications" subtitle="From organizations you follow">
      {items.length === 0 ? (
        <div className="py-6 text-center">
          <Mascot mood="resting" size="md" soft className="mx-auto text-accent" />
          <p className="mt-3 text-[15px] font-medium text-fg">Nothing new</p>
          <p className="mx-auto mt-1 max-w-xs text-[13px] leading-relaxed text-subtle">
            Follow organizations and you&rsquo;ll hear about their events here.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((e) => (
            <li key={e.id}>
              <button
                type="button"
                onClick={() => navigate(`/app/community?event=${e.id}`)}
                className="flex w-full items-start gap-3 py-3 text-left transition-colors duration-150 hover:bg-surface-2"
              >
                <OrgLogo org={e.org} className="mt-0.5 size-9" rounded="rounded-lg" textClass="text-[11px]" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13.5px] leading-snug text-fg">
                    <span className="font-semibold">{e.org.name}</span> posted a new event
                  </span>
                  <span className="block truncate text-[12.5px] text-muted">{e.title}</span>
                  <span className="block text-[11.5px] text-subtle">
                    {postedAgoLabel(e.postedDaysAgo)}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 border-t border-border pt-3 text-[11px] text-subtle">
        Demo: notifications are mocked from your follows. Real delivery arrives with accounts.
      </p>
    </CommunitySubPage>
  )
}
