import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Check, Clock, GraduationCap, Loader2 } from 'lucide-react'
import { Mascot } from '@/components/Mascot'
import { VerifiedBadge } from '@/features/community/VerifiedBadge'
import { OrgLogo } from '@/features/community/OrgLogo'
import { PersonAvatar } from '@/features/community/PersonAvatar'
import { useCommunity } from '@/features/community/useCommunity'
import { useFollows } from '@/app/providers/follows'
import { orgSlug, type EventOrg } from '@/data/community'
import {
  acceptFriend,
  listFollowing,
  listFriends,
  removeFriend,
  unfollowUser,
  type FollowedUser,
  type Friend,
} from '@/lib/social'
import { cn } from '@/lib/cn'
import { Avatar, Chat } from './Chat'
import { PersonMenu, PersonMenuButton, type PersonTarget } from './PersonMenu'
import { founderFor } from './founders'

/**
 * Messages — conversations, requests, and who you follow.
 *
 * PILLS, NOT TABS, and the first one is not called "Messages".
 *
 * The old version put a row of underlined tabs under a bottom-bar tab that was
 * already called Messages, and the first of those tabs was ALSO called
 * Messages. Two identical words on top of each other, one of which navigated
 * and one of which filtered. Pills read as filters on the list below them —
 * which is exactly what they are, and exactly the shape every messaging app
 * a student already uses puts there.
 *
 * REQUESTS EARNS ITS OWN PILL because it is the only one where somebody is
 * waiting on you, so it is the only one that carries a count. A badge on every
 * pill is a badge on none of them.
 *
 * ONE FOLLOWING LIST, orgs and people together. They used to live in two
 * different popovers in two different headers; the same list twice, in places
 * neither of them belonged.
 */
type Pill = 'inbox' | 'requests' | 'following'

export function PeoplePanel() {
  const [params, setParams] = useSearchParams()
  // `?people=requests` so a link can land on the right pill. Read ONCE as an
  // initial value: after that the pills are yours to click and the URL should
  // not drag you back. `messages` is the old name for `inbox`, still honoured.
  const [pill, setPill] = useState<Pill>(() => {
    const want = params.get('people')
    if (want === 'requests' || want === 'following') return want
    return 'inbox'
  })
  const [friends, setFriends] = useState<Friend[] | null>(null)
  const [following, setFollowing] = useState<FollowedUser[] | null>(null)
  const [active, setActive] = useState<Friend | null>(null)
  const [tick, setTick] = useState(0)
  const [menu, setMenu] = useState<PersonTarget | null>(null)
  const refresh = useCallback(() => setTick((n) => n + 1), [])

  useEffect(() => {
    let alive = true
    void listFriends().then((r) => alive && setFriends(r))
    void listFollowing().then((r) => alive && setFollowing(r))
    return () => {
      alive = false
    }
  }, [tick])

  /**
   * `?chat=handle` opens straight into a conversation, so a Message button
   * anywhere in the app lands you in the right thread rather than in a list.
   *
   * Adjusted DURING RENDER rather than in an effect, tracking the handle we
   * last opened for: an effect that sets state on data arrival renders twice
   * and trips react-hooks/set-state-in-effect. `opened` is state, not a ref, so
   * a re-render cannot open the same thread again.
   */
  const wanted = params.get('chat')
  const [opened, setOpened] = useState<string | null>(null)
  if (wanted && friends && opened !== wanted) {
    setOpened(wanted)
    const found = friends.find(
      (f) => f.status === 'accepted' && f.handle.toLowerCase() === wanted.toLowerCase(),
    )
    if (found) setActive(found)
  }

  const accepted = (friends ?? []).filter((f) => f.status === 'accepted')
  const incoming = (friends ?? []).filter(
    (f) => f.status === 'pending' && f.direction === 'incoming',
  )
  const outgoing = (friends ?? []).filter(
    (f) => f.status === 'pending' && f.direction === 'outgoing',
  )

  /**
   * `?attach=event:ev-123` — a Share button elsewhere in the app hands the
   * thing over in the URL, so "send this to a friend" arrives in the composer
   * instead of making you hunt for it again in the + menu.
   *
   * Only kinds that are safe to reconstruct from an id are accepted; anything
   * else is ignored rather than trusted.
   */
  const attachParam = params.get('attach')
  const { events } = useCommunity()
  const initialAttachment = useMemo(() => {
    if (!attachParam) return undefined
    const [kind, ...rest] = attachParam.split(':')
    const id = rest.join(':')
    if (!id) return undefined
    if (kind === 'event') {
      const e = events.find((x) => x.id === id)
      return { kind: 'event' as const, id, title: e?.title ?? 'Event' }
    }
    if (kind === 'course') return { kind: 'course' as const, code: id }
    return undefined
  }, [attachParam, events])

  const openChat = (f: Friend) => {
    setActive(f)
    setPill('inbox')
    const next = new URLSearchParams(params)
    next.set('chat', f.handle)
    setParams(next, { replace: true })
  }

  const PILLS: { id: Pill; label: string; badge: number }[] = [
    { id: 'inbox', label: 'Inbox', badge: 0 },
    { id: 'requests', label: 'Requests', badge: incoming.length },
    { id: 'following', label: 'Following', badge: 0 },
  ]

  return (
    <div className="flex min-h-0 flex-col">
      {/* One scrolling row, edges not cut. Same treatment as the event filter
          chips, because it is the same kind of control. */}
      <div className="-mx-4 mb-3 overflow-x-auto px-4 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex w-max gap-2" role="tablist">
          {PILLS.map((p) => (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={pill === p.id}
              onClick={() => setPill(p.id)}
              className={cn(
                'flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-medium',
                'transition-[background-color,color,box-shadow] duration-150 active:scale-95',
                pill === p.id
                  ? 'bg-accent-soft text-fg shadow-[inset_0_0_0_1px_var(--ct-accent)]'
                  : 'bg-surface-2/70 text-muted hover:text-fg',
              )}
            >
              {p.label}
              {p.badge > 0 && (
                <span className="grid min-w-[18px] place-items-center rounded-full bg-accent px-1 text-[10.5px] font-semibold text-accent-contrast">
                  {p.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {friends === null && (
        <p className="flex items-center gap-2 py-10 text-[13px] text-subtle">
          <Loader2 size={15} className="animate-spin" aria-hidden />
          Loading
        </p>
      )}

      {friends !== null && pill === 'inbox' && (
        /**
         * On a phone the thread list is just a list, in the page, scrolling
         * with everything else. It used to be a bordered box locked to 70vh,
         * which on one conversation drew an empty rectangle taller than the
         * screen and could not scroll with the page around it. The two-pane
         * panel is a DESKTOP shape and now only exists there.
         */
        <div
          className={cn(
            'flex overflow-hidden border-border',
            // The panel is a DESKTOP shape: on a phone the list is bare, in the
            // page, with no card around it. A full-screen chat is the exception
            // and needs the surface behind it.
            active ? 'bg-surface' : 'lg:bg-surface',
            active
              ? 'fixed inset-0 z-50 lg:static lg:z-auto lg:h-[min(70vh,640px)] lg:rounded-2xl lg:border'
              : 'lg:h-[min(70vh,640px)] lg:rounded-2xl lg:border',
          )}
        >
          <aside
            className={cn(
              'min-h-0 w-full shrink-0 border-border lg:w-72 lg:overflow-y-auto lg:border-r',
              active && 'hidden lg:block',
            )}
          >
            {accepted.length === 0 ? (
              <div className="lg:p-4">
                <Empty
                  title="No conversations yet"
                  body="Connections are two-way. Open a classmate's profile, send a request, and once they accept you can message them."
                />
              </div>
            ) : (
              <ul className="divide-y divide-border lg:divide-y-0">
                {accepted.map((f) => (
                  <li
                    key={f.friendship_id}
                    className={cn(
                      'group flex items-center pr-1 transition-colors duration-150',
                      active?.user_id === f.user_id ? 'lg:bg-accent-soft' : 'hover:bg-surface-2/60',
                    )}
                    onContextMenu={(e) => {
                      e.preventDefault()
                      setMenu(targetFor(f, { x: e.clientX, y: e.clientY }))
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => openChat(f)}
                      className="flex min-w-0 flex-1 items-center gap-3 py-2.5 pr-1 pl-0.5 text-left lg:px-3"
                    >
                      <Avatar friend={f} size={44} />
                      <span className="min-w-0">
                        <span className="flex items-center gap-1 text-[14px] text-fg">
                          <span className="truncate">{f.name ?? f.handle}</span>
                          {founderFor(f.handle) && <VerifiedBadge size={12} />}
                        </span>
                        <span className="block truncate text-[12.5px] text-subtle">
                          @{f.handle}
                        </span>
                      </span>
                    </button>
                    <PersonMenuButton onOpen={(at) => setMenu(targetFor(f, at))} />
                  </li>
                ))}
              </ul>
            )}
          </aside>

          {active ? (
            <>
              <Chat
                friend={active}
                onBack={() => setActive(null)}
                initialAttachment={initialAttachment}
              />
              {/* Who you are talking to, without leaving the conversation. */}
              <aside className="hidden w-56 shrink-0 border-l border-border p-4 xl:block">
                <Avatar friend={active} size={64} />
                <p className="mt-2.5 flex items-center gap-1 text-[14px] font-medium text-fg">
                  <span className="min-w-0 truncate">{active.name ?? active.handle}</span>
                  {founderFor(active.handle) && <VerifiedBadge size={14} />}
                </p>
                <p className="text-[12px] text-subtle">@{active.handle}</p>
                {active.program && (
                  <p className="mt-2 flex items-center gap-1.5 text-[12px] text-muted">
                    <GraduationCap size={13} className="shrink-0 text-accent" aria-hidden />
                    <span className="min-w-0 truncate">{active.program}</span>
                  </p>
                )}
                <Link
                  to={`/@${active.handle}`}
                  className="mt-3 block truncate rounded-lg border border-border px-2.5 py-1.5 text-center text-[12px] text-muted transition-colors duration-150 hover:border-accent hover:text-fg"
                >
                  View profile
                </Link>
              </aside>
            </>
          ) : (
            accepted.length > 0 && (
              <div className="hidden flex-1 place-items-center p-6 text-center lg:grid">
                <p className="max-w-xs text-[12.5px] leading-relaxed text-subtle">
                  Pick someone to see your conversation. The + sends a schedule, a class or an
                  event, and they open the live thing rather than a screenshot.
                </p>
              </div>
            )
          )}
        </div>
      )}

      {friends !== null && pill === 'requests' && (
        <div className="space-y-5">
          {/* Empty sections do not render, and "Connected" is not one of them:
              your existing connections are the Inbox, and listing them again
              here is the same list twice under a different word. */}
          {incoming.length > 0 && (
            <Section title="Waiting on you" count={incoming.length}>
              <ul className="space-y-2">
                {incoming.map((f) => (
                  <PersonRow
                    key={f.friendship_id}
                    friend={f}
                    onMenu={(at) => setMenu(targetFor(f, at))}
                  >
                    <button
                      type="button"
                      onClick={() => void acceptFriend(f.friendship_id).then(refresh)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-[12.5px] font-medium text-accent-contrast transition-colors duration-150 hover:bg-accent-hover"
                    >
                      <Check size={13} aria-hidden />
                      Accept
                    </button>
                    <button
                      type="button"
                      onClick={() => void removeFriend(f.friendship_id).then(refresh)}
                      className="rounded-lg border border-border px-2.5 py-1.5 text-[12.5px] text-muted transition-colors duration-150 hover:text-fg"
                    >
                      Decline
                    </button>
                  </PersonRow>
                ))}
              </ul>
            </Section>
          )}

          {outgoing.length > 0 && (
            <Section title="You asked" count={outgoing.length}>
              <ul className="space-y-2">
                {outgoing.map((f) => (
                  <PersonRow
                    key={f.friendship_id}
                    friend={f}
                    onMenu={(at) => setMenu(targetFor(f, at))}
                  >
                    <span className="inline-flex items-center gap-1.5 text-[12px] text-subtle">
                      <Clock size={13} aria-hidden />
                      Waiting
                    </span>
                    <button
                      type="button"
                      onClick={() => void removeFriend(f.friendship_id).then(refresh)}
                      className="rounded-lg border border-border px-2.5 py-1.5 text-[12.5px] text-muted transition-colors duration-150 hover:text-fg"
                    >
                      Cancel
                    </button>
                  </PersonRow>
                ))}
              </ul>
            </Section>
          )}

          {incoming.length + outgoing.length === 0 && (
            <Empty
              title="Nothing waiting"
              body="Requests you send and requests you get both land here. Search a classmate's handle to send one."
            />
          )}
        </div>
      )}

      {pill === 'following' && <FollowingList people={following} onChanged={refresh} />}

      {menu && (
        <PersonMenu
          target={menu}
          onMessage={() => {
            const f = accepted.find((x) => x.handle === menu.handle)
            if (f) openChat(f)
          }}
          onChanged={refresh}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  )
}

/**
 * Everything you follow, in one list.
 *
 * Orgs and people are different kinds of account, so they get headings — the
 * same treatment search gives them. They do NOT get separate tabs: "who do I
 * follow" is one question, and answering it in two places is how the follow
 * list ended up living in two popovers nobody could find on a phone.
 */
function FollowingList({
  people,
  onChanged,
}: {
  people: FollowedUser[] | null
  onChanged: () => void
}) {
  const { orgs } = useCommunity()
  const { followedHandles, toggleFollow } = useFollows()
  const followedOrgs = useMemo(
    () => orgs.filter((o) => followedHandles.includes(o.handle)),
    [orgs, followedHandles],
  )

  if (people === null) return null

  if (followedOrgs.length === 0 && people.length === 0) {
    return (
      <Empty
        title="Not following anyone"
        body="Following is one-way and instant. It needs nobody's permission and gives you nothing but what they post publicly — clubs' events, classmates' outlines."
      />
    )
  }

  return (
    <div className="space-y-5">
      {followedOrgs.length > 0 && (
        <Section title="Organizations" count={followedOrgs.length}>
          <ul className="space-y-2">
            {followedOrgs.map((o) => (
              <OrgRow key={o.handle} org={o} onUnfollow={() => toggleFollow(o.handle)} />
            ))}
          </ul>
        </Section>
      )}

      {people.length > 0 && (
        <Section title="People" count={people.length}>
          <ul className="space-y-2">
            {people.map((p) => (
              <li
                key={p.user_id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2.5"
              >
                <PersonAvatar
                  person={{ handle: p.handle, name: p.name, avatar_url: p.avatar_url }}
                  className="size-9"
                />
                <Link to={`/@${p.handle}`} className="group min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-fg group-hover:underline">
                    {p.name ?? p.handle}
                  </span>
                  <span className="block truncate text-[11.5px] text-subtle">
                    @{p.handle}
                    {p.program ? ` · ${p.program}` : ''}
                  </span>
                </Link>
                <button
                  type="button"
                  onClick={() => void unfollowUser(p.handle).then(onChanged)}
                  className="rounded-lg border border-border px-2.5 py-1.5 text-[12.5px] text-muted transition-colors duration-150 hover:border-danger hover:text-danger"
                >
                  Unfollow
                </button>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  )
}

function OrgRow({ org, onUnfollow }: { org: EventOrg; onUnfollow: () => void }) {
  return (
    <li className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2.5">
      <Link
        to={`/app/community/org/${orgSlug(org)}`}
        className="group flex min-w-0 flex-1 items-center gap-3"
      >
        <OrgLogo org={org} className="size-9" rounded="rounded-lg" />
        <span className="min-w-0">
          <span className="flex items-center gap-1 text-[13px] font-medium text-fg group-hover:underline">
            <span className="truncate">{org.name}</span>
            {org.verified && <VerifiedBadge size={12} />}
          </span>
          <span className="block truncate text-[11.5px] text-subtle">{org.handle}</span>
        </span>
      </Link>
      <button
        type="button"
        onClick={onUnfollow}
        className="rounded-lg border border-border px-2.5 py-1.5 text-[12.5px] text-muted transition-colors duration-150 hover:border-danger hover:text-danger"
      >
        Unfollow
      </button>
    </li>
  )
}

function Section({
  title,
  count,
  children,
}: {
  title: string
  count: number
  children: React.ReactNode
}) {
  return (
    <section>
      <h2 className="mb-2 flex items-baseline gap-2 text-[11px] font-semibold tracking-wide text-subtle uppercase">
        {title}
        <span className="font-normal normal-case">{count}</span>
      </h2>
      {children}
    </section>
  )
}

function PersonRow({
  friend,
  onMenu,
  children,
}: {
  friend: Friend
  onMenu?: (at: { x: number; y: number }) => void
  children: React.ReactNode
}) {
  return (
    <li
      className="group flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2.5"
      onContextMenu={
        onMenu
          ? (e) => {
              e.preventDefault()
              onMenu({ x: e.clientX, y: e.clientY })
            }
          : undefined
      }
    >
      <Avatar friend={friend} size={36} />
      <Link to={`/@${friend.handle}`} className="group min-w-0 flex-1">
        <span className="flex items-center gap-1 text-[13px] font-medium text-fg group-hover:underline">
          <span className="truncate">{friend.name ?? friend.handle}</span>
          {founderFor(friend.handle) && <VerifiedBadge size={13} />}
        </span>
        <span className="block truncate text-[11.5px] text-subtle">
          @{friend.handle}
          {friend.program ? ` · ${friend.program}` : ''}
        </span>
      </Link>
      <span className="flex shrink-0 items-center gap-1.5">
        {children}
        {onMenu && <PersonMenuButton onOpen={onMenu} />}
      </span>
    </li>
  )
}

/** One shape for the menu, whichever row opened it. */
function targetFor(f: Friend, at: { x: number; y: number }): PersonTarget {
  return {
    handle: f.handle,
    name: f.name,
    friendshipId: f.status === 'accepted' ? f.friendship_id : undefined,
    at,
  }
}

/** Nothing is wrong here — an empty list is a normal state, so it gets the
 *  mascot rather than a bare line of grey text. */
function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border px-5 py-12 text-center">
      <Mascot mood="resting" size="sm" soft className="text-accent" />
      <p className="text-[13.5px] font-medium text-fg">{title}</p>
      <p className="max-w-sm text-[12.5px] leading-relaxed text-subtle">{body}</p>
    </div>
  )
}
