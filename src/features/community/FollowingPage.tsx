import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { UserPlus } from 'lucide-react'
import { useFollows } from '@/app/providers/follows'
import { listFollowing, unfollowUser, type FollowedUser } from '@/lib/social'
import { PersonAvatar } from './PersonAvatar'
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
 *
 * PEOPLE LIVE HERE TOO, and that is the point of it being a page. The list
 * used to be split: organisations here, classmates behind a pill in Messages.
 * Following is ONE question and it was being answered in two places neither of
 * which was obviously the place. Messages is for conversations; that pill is
 * Support now, and the whole follow list is here, where a URL can reach it.
 */
export function FollowingPage() {
  const { followedHandles } = useFollows()
  const { orgByHandle } = useCommunity()
  const orgs = followedHandles.map((h) => orgByHandle(h)).filter((o) => o !== undefined)
  const [people, setPeople] = useState<FollowedUser[] | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let alive = true
    void listFollowing()
      .then((r) => alive && setPeople(r))
      .catch(() => alive && setPeople([]))
    return () => {
      alive = false
    }
  }, [tick])

  const count = orgs.length + (people?.length ?? 0)
  const empty = count === 0 && people !== null

  return (
    <CommunitySubPage
      title="Following"
      subtitle={`${orgs.length} organization${orgs.length === 1 ? '' : 's'}${
        people && people.length > 0
          ? ` · ${people.length} ${people.length === 1 ? 'person' : 'people'}`
          : ''
      }`}
    >
      {empty ? (
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
      ) : orgs.length === 0 ? null : (
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

      {people && people.length > 0 && (
        <>
          <h2 className="mt-6 mb-1 text-[11px] font-semibold tracking-wide text-subtle uppercase">
            People
          </h2>
          <ul className="divide-y divide-border">
            {people.map((p) => (
              <li key={p.user_id} className="flex items-center gap-3 py-2.5">
                <Link to={`/@${p.handle}`} className="flex min-w-0 flex-1 items-center gap-3">
                  <PersonAvatar
                    person={{ handle: p.handle, name: p.name, avatar_url: p.avatar_url }}
                    className="size-10"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium text-fg">
                      {p.name ?? p.handle}
                    </span>
                    <span className="block truncate text-[12.5px] text-subtle">
                      @{p.handle}
                      {p.program ? ` · ${p.program}` : ''}
                    </span>
                  </span>
                </Link>
                <button
                  type="button"
                  onClick={() => void unfollowUser(p.handle).then(() => setTick((n) => n + 1))}
                  className="shrink-0 rounded-lg border border-border px-2.5 py-1.5 text-[12.5px] text-muted transition-colors duration-150 hover:border-danger hover:text-danger"
                >
                  Unfollow
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </CommunitySubPage>
  )
}
