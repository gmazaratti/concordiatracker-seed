import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Check, Clock, GraduationCap, Loader2, MessageSquare, Rss, UserPlus } from 'lucide-react'
import { Mascot } from '@/components/Mascot'
import { VerifiedBadge } from '@/features/community/VerifiedBadge'
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
import { useCommunity } from '@/features/community/useCommunity'
import { Avatar, Chat } from './Chat'
import { PersonMenu, PersonMenuButton, type PersonTarget } from './PersonMenu'
import { founderFor } from './founders'

/**
 * People: conversations, requests, and who you follow.
 *
 * Lives inside Community rather than as its own destination, because it is the
 * same job — the part of the app that is about other people — and a sixth
 * top-level tab for a message list is a tab nobody asked for.
 *
 * The chat takes the whole width it is given. A conversation squeezed into a
 * modal is a conversation you close instead of having.
 */
type Tab = 'messages' | 'requests' | 'following'

export function PeoplePanel() {
  const [params, setParams] = useSearchParams()
  // `?people=following` so a link can land on the right subtab. Read once as
  // an initial value: after that the tabs are yours to click and the URL
  // should not drag you back.
  const [tab, setTab] = useState<Tab>(() => {
    const want = params.get('people')
    return want === 'requests' || want === 'following' ? want : 'messages'
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
  const incoming = (friends ?? []).filter((f) => f.status === 'pending' && f.direction === 'incoming')
  const outgoing = (friends ?? []).filter((f) => f.status === 'pending' && f.direction === 'outgoing')

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
      // Resolved from the feed rather than left as the literal word "Event",
      // which is what the composer chip was showing.
      const e = events.find((x) => x.id === id)
      return { kind: 'event' as const, id, title: e?.title ?? 'Event' }
    }
    if (kind === 'course') return { kind: 'course' as const, code: id }
    return undefined
  }, [attachParam, events])

  const openChat = (f: Friend) => {
    setActive(f)
    setTab('messages')
    const next = new URLSearchParams(params)
    next.set('chat', f.handle)
    setParams(next, { replace: true })
  }

  const TABS: { id: Tab; label: string; icon: typeof Rss; badge: number }[] = [
    { id: 'messages', label: 'Messages', icon: MessageSquare, badge: 0 },
    // The only tab where somebody is waiting on YOU, so the only one with a
    // count. A badge on everything is a badge on nothing.
    { id: 'requests', label: 'Requests', icon: UserPlus, badge: incoming.length },
    { id: 'following', label: 'Following', icon: Rss, badge: 0 },
  ]

  return (
    <div className="flex min-h-0 flex-col">
      <nav className="mb-3 flex gap-1 border-b border-border" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              '-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-[13px] font-medium transition-colors duration-150',
              tab === t.id ? 'border-accent text-fg' : 'border-transparent text-muted hover:text-fg',
            )}
          >
            <t.icon size={14} aria-hidden />
            {t.label}
            {t.badge > 0 && (
              <span className="rounded-full bg-accent px-1.5 text-[10.5px] font-semibold text-accent-contrast">
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </nav>

      {friends === null && (
        <p className="flex items-center gap-2 py-10 text-[13px] text-subtle">
          <Loader2 size={15} className="animate-spin" aria-hidden />
          Loading
        </p>
      )}

      {/* On a phone an open conversation takes the whole screen: a chat in a
          420px box inside a scrolling page is a chat you cannot type in with a
          keyboard up. Everything else keeps the panel. */}
      {friends !== null && tab === 'messages' && (
        <div
          className={cn(
            'flex overflow-hidden border-border bg-surface',
            active
              ? 'fixed inset-0 z-50 lg:static lg:z-auto lg:h-[min(70vh,640px)] lg:rounded-xl lg:border'
              : 'h-[min(70vh,640px)] rounded-xl border',
          )}
        >
          {/* Thread list. Gives way entirely on a phone: two panels in 375px is
              two unusable panels. */}
          <aside
            className={cn(
              'min-h-0 w-full shrink-0 overflow-y-auto border-border lg:w-64 lg:border-r',
              active && 'hidden lg:block',
            )}
          >
            {accepted.length === 0 ? (
              <div className="p-4">
                <Empty
                  title="No one to message yet"
                  body="Connections are two-way. Open someone's profile and send a request; once they accept you can message them."
                />
              </div>
            ) : (
              <ul>
                {accepted.map((f) => (
                  <li
                    key={f.friendship_id}
                    className={cn(
                      'group flex items-center pr-1 transition-colors duration-150',
                      active?.user_id === f.user_id ? 'bg-accent-soft' : 'hover:bg-surface-2',
                    )}
                    onContextMenu={(e) => {
                      e.preventDefault()
                      setMenu(targetFor(f, { x: e.clientX, y: e.clientY }))
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => openChat(f)}
                      className={cn(
                        'flex min-w-0 flex-1 items-center gap-2.5 px-3 py-2.5 text-left',
                        active?.user_id === f.user_id ? 'text-fg' : 'text-muted',
                      )}
                    >
                      <Avatar friend={f} size={34} />
                      <span className="min-w-0">
                        <span className="flex items-center gap-1 text-[12.5px]">
                          <span className="truncate">{f.name ?? f.handle}</span>
                          {founderFor(f.handle) && <VerifiedBadge size={12} />}
                        </span>
                        <span className="block truncate text-[11px] text-subtle">@{f.handle}</span>
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
                <p className="mt-2 truncate text-[11px] text-subtle" title={`/@${active.handle}`}>
                  concordiatracker.com/@{active.handle}
                </p>
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

      {friends !== null && tab === 'requests' && (
        <div className="space-y-5">
          {/* Empty sections do not render. A page of "nothing here" boxes is
              what made this feel dead the first time. */}
          {incoming.length > 0 && (
            <Section title="Waiting on you" count={incoming.length}>
              <ul className="space-y-2">
                {incoming.map((f) => (
                  <PersonRow key={f.friendship_id} friend={f} onMenu={(at) => setMenu(targetFor(f, at))}>
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

          {accepted.length > 0 && (
            <Section title="Connected" count={accepted.length}>
              <ul className="space-y-2">
                {accepted.map((f) => (
                  <PersonRow
                    key={f.friendship_id}
                    friend={f}
                    onMenu={(at) => setMenu(targetFor(f, at))}
                  >
                    <button
                      type="button"
                      onClick={() => openChat(f)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[12.5px] text-muted transition-colors duration-150 hover:border-accent hover:text-fg"
                    >
                      <MessageSquare size={13} aria-hidden />
                      Message
                    </button>
                  </PersonRow>
                ))}
              </ul>
            </Section>
          )}

          {incoming.length + outgoing.length + accepted.length === 0 && (
            <Empty
              title="Nobody yet"
              body="Open a classmate's profile at /@their-handle and send a connection request. Once they accept you can message them and see their schedule if they share it."
            />
          )}
        </div>
      )}

      {tab === 'following' &&
        (following === null ? null : following.length === 0 ? (
          <Empty
            title="Not following anyone"
            body="Following is one-way and instant. It needs nobody's permission and gives you nothing but what they post publicly."
          />
        ) : (
          <ul className="space-y-2">
            {following.map((p) => (
              <li
                key={p.user_id}
                className="group flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2.5"
                onContextMenu={(e) => {
                  e.preventDefault()
                  setMenu({
                    handle: p.handle,
                    name: p.name,
                    following: true,
                    at: { x: e.clientX, y: e.clientY },
                  })
                }}
              >
                <Avatar
                  friend={{ ...p, friendship_id: '', status: 'accepted', direction: 'outgoing' }}
                  size={34}
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
                  onClick={() => void unfollowUser(p.handle).then(refresh)}
                  className="rounded-lg border border-border px-2.5 py-1.5 text-[12.5px] text-muted transition-colors duration-150 hover:border-danger hover:text-danger"
                >
                  Unfollow
                </button>
                <PersonMenuButton
                  onOpen={(at) =>
                    setMenu({ handle: p.handle, name: p.name, following: true, at })
                  }
                />
              </li>
            ))}
          </ul>
        ))}

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
      <Avatar friend={friend} size={34} />
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
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-5 py-10 text-center">
      <Mascot mood="resting" size="sm" soft className="text-accent" />
      <p className="text-[13px] font-medium text-fg">{title}</p>
      <p className="max-w-sm text-[12px] leading-relaxed text-subtle">{body}</p>
    </div>
  )
}
