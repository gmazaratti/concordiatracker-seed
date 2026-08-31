import { Link } from 'react-router-dom'
import { UserPlus } from 'lucide-react'
import { useFollows } from '@/app/providers/follows'
import { orgSlug } from '@/data/community'
import { Mascot } from '@/components/Mascot'
import { useCommunity } from './useCommunity'
import { OrgLogo } from './OrgLogo'
import { VerifiedBadge } from './VerifiedBadge'
import { FollowButton } from './FollowButton'
import { CommunitySubPage } from './CommunitySubPage'

/**
 * Everyone you follow, as a page.
 *
 * It was a popover, and a popover was the wrong container for it: the list has
 * no ceiling, every row has its own destination and its own unfollow control,
 * and on a phone a 288px panel hanging off a header button gave each of those
 * about forty pixels. A page also gets a URL, which means back works and the
 * list can be linked to.
 *
 * The rail on wide screens still shows a summary — that is a glance, this is
 * the whole thing.
 */
export function FollowingPage() {
  const { followedHandles } = useFollows()
  const { orgByHandle } = useCommunity()
  const orgs = followedHandles.map((h) => orgByHandle(h)).filter((o) => o !== undefined)

  return (
    <CommunitySubPage title="Following" subtitle={`${orgs.length} organization${orgs.length === 1 ? '' : 's'}`}>
      {orgs.length === 0 ? (
        <div className="py-6 text-center">
          <Mascot mood="resting" size="md" soft className="mx-auto text-accent" />
          <p className="mt-3 text-[15px] font-medium text-fg">Not following anyone yet</p>
          <p className="mx-auto mt-1 max-w-xs text-[13px] leading-relaxed text-subtle">
            Follow an organization and their events show up here, and in your notifications.
          </p>
          <Link
            to="/app/community"
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-[13px] font-medium text-accent-contrast transition-colors duration-150 hover:bg-accent-hover"
          >
            <UserPlus size={14} aria-hidden />
            Find organizations
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {orgs.map((org) => (
            <li key={org.handle} className="flex items-center gap-3 py-2.5">
              <Link
                to={`/app/community/org/${orgSlug(org)}`}
                className="flex min-w-0 flex-1 items-center gap-3"
              >
                <OrgLogo org={org} className="size-10" rounded="rounded-lg" textClass="text-[12px]" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1 text-[14px] font-medium text-fg">
                    <span className="truncate">{org.name}</span>
                    {org.verified && <VerifiedBadge size={13} />}
                  </span>
                  <span className="block truncate text-[12.5px] text-subtle">{org.handle}</span>
                </span>
              </Link>
              <FollowButton handle={org.handle} size="sm" className="shrink-0" />
            </li>
          ))}
        </ul>
      )}
    </CommunitySubPage>
  )
}
