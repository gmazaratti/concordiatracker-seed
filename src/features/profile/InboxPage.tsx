import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Clock, Inbox, Loader2, MessageSquare, Rss, UserPlus } from 'lucide-react'
import { Mascot } from '@/components/Mascot'
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
import { Conversation } from './Messages'

/**
 * Everything to do with other people, in one place.
 *
 * It was scattered: requests could only be found by visiting the profile of
 * whoever sent one, and conversations lived in a modal behind a button on your
 * own profile. Both of those are places you go for a reason, which is the wrong
 * shape for something that arrives without warning.
 *
 * Three tabs, in the order they demand attention: what somebody is waiting on
 * from you, what you are in the middle of, and who you follow.
 */
type Tab = 'messages' | 'requests' | 'following'

export function InboxPage() {
  const [tab, setTab] = useState<Tab>('messages')
  const [friends, setFriends] = useState<Friend[] | null>(null)
  const [following, setFollowing] = useState<FollowedUser[] | null>(null)
  const [active, setActive] = useState<Friend | null>(null)
  const [tick, setTick] = useState(0)
  const refresh = useCallback(() => setTick((n) => n + 1), [])

  useEffect(() => {
    let alive = true
    void listFriends().then((r) => alive && setFriends(r))
    void listFollowing().then((r) => alive && setFollowing(r))
    return () => {
      alive = false
    }
  }, [tick])

  const accepted = (friends ?? []).filter((f) => f.status === 'accepted')
  const incoming = (friends ?? []).filter(
    (f) => f.status === 'pending' && f.direction === 'incoming',
  )
  const outgoing = (friends ?? []).filter(
    (f) => f.status === 'pending' && f.direction === 'outgoing',
  )

  const TABS: { id: Tab; label: string; icon: typeof Inbox; badge?: number }[] = [
    { id: 'messages', label: 'Messages', icon: MessageSquare, badge: 0 },
    // The count is on requests and nowhere else: it is the only tab where
    // somebody is waiting on YOU, and a badge on everything is a badge on
    // nothing.
    { id: 'requests', label: 'Requests', icon: UserPlus, badge: incoming.length },
    { id: 'following', label: 'Following', icon: Rss, badge: 0 },
  ]

  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-5 sm:px-6">
      <header className="mb-4">
        <h1 className="font-display text-[26px] leading-tight font-medium text-fg">People</h1>
        <p className="mt-0.5 text-[13px] text-subtle">
          Your conversations, the requests waiting on you, and who you follow.
        </p>
      </header>

      <nav className="mb-4 flex gap-1 border-b border-border" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              '-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-[13px] font-medium transition-colors duration-150',
              tab === t.id
                ? 'border-accent text-fg'
                : 'border-transparent text-muted hover:text-fg',
            )}
          >
            <t.icon size={14} aria-hidden />
            {t.label}
            {t.badge ? (
              <span className="rounded-full bg-accent px-1.5 text-[10.5px] font-semibold text-accent-contrast">
                {t.badge}
              </span>
            ) : null}
          </button>
        ))}
      </nav>

      {friends === null && (
        <p className="flex items-center gap-2 py-10 text-[13px] text-subtle">
          <Loader2 size={15} className="animate-spin" aria-hidden />
          Loading
        </p>
      )}

      {friends !== null && tab === 'messages' && (
        <div className="flex min-h-[420px] flex-col overflow-hidden rounded-xl border border-border bg-surface sm:h-[520px] sm:flex-row">
          <aside
            className={cn(
              'min-h-0 shrink-0 overflow-y-auto border-border sm:w-56 sm:border-r',
              active ? 'hidden sm:block' : 'flex-1 sm:flex-none',
            )}
          >
            {accepted.length === 0 ? (
              <div className="p-4">
                <Empty
                  title="No one to message yet"
                  body="Connections are two-way: open someone's profile at /@their-handle and send a request. Once they accept, you can message them."
                />
              </div>
            ) : (
              <ul>
                {accepted.map((f) => (
                  <li key={f.friendship_id}>
                    <button
                      type="button"
                      onClick={() => setActive(f)}
                      className={cn(
                        'flex w-full items-center gap-2 px-3 py-2 text-left transition-colors duration-150',
                        active?.user_id === f.user_id
                          ? 'bg-accent-soft text-fg'
                          : 'text-muted hover:bg-surface-2 hover:text-fg',
                      )}
                    >
                      <Initials name={f.name ?? f.handle} />
                      <span className="min-w-0">
                        <span className="block truncate text-[12.5px]">{f.name ?? f.handle}</span>
                        <span className="block truncate text-[11px] text-subtle">@{f.handle}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </aside>

          <div className="flex min-h-0 flex-1 flex-col">
            {active ? (
              <Conversation friend={active} onBack={() => setActive(null)} />
            ) : (
              accepted.length > 0 && (
                <div className="hidden flex-1 place-items-center p-6 text-center sm:grid">
                  <p className="max-w-xs text-[12.5px] leading-relaxed text-subtle">
                    Pick someone to see your conversation. You can send a schedule, a class or an
                    outline — they open the live thing, not a screenshot.
                  </p>
                </div>
              )
            )}
          </div>
        </div>
      )}

      {friends !== null && tab === 'requests' && (
        <div className="space-y-5">
          <Section title="Waiting on you" count={incoming.length}>
            {incoming.length === 0 ? (
              <Empty title="Nothing waiting" body="Requests people send you land here." />
            ) : (
              <ul className="space-y-2">
                {incoming.map((f) => (
                  <PersonRow key={f.friendship_id} handle={f.handle} name={f.name} sub={f.program}>
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
            )}
          </Section>

          <Section title="You asked" count={outgoing.length}>
            {outgoing.length === 0 ? (
              <Empty title="No requests out" body="Ones you send show here until they answer." />
            ) : (
              <ul className="space-y-2">
                {outgoing.map((f) => (
                  <PersonRow key={f.friendship_id} handle={f.handle} name={f.name} sub={f.program}>
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
            )}
          </Section>

          <Section title="Connected" count={accepted.length}>
            {accepted.length === 0 ? (
              <Empty title="No connections yet" body="They unlock messages, and a schedule if the other person shares theirs." />
            ) : (
              <ul className="space-y-2">
                {accepted.map((f) => (
                  <PersonRow key={f.friendship_id} handle={f.handle} name={f.name} sub={f.program}>
                    <button
                      type="button"
                      onClick={() => {
                        setActive(f)
                        setTab('messages')
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[12.5px] text-muted transition-colors duration-150 hover:border-accent hover:text-fg"
                    >
                      <MessageSquare size={13} aria-hidden />
                      Message
                    </button>
                  </PersonRow>
                ))}
              </ul>
            )}
          </Section>
        </div>
      )}

      {tab === 'following' && (
        <Section title="Following" count={following?.length ?? 0}>
          {following === null ? null : following.length === 0 ? (
            <Empty
              title="Not following anyone"
              body="Following is one-way and instant — it needs nobody's permission and gives you nothing but their public posts."
            />
          ) : (
            <ul className="space-y-2">
              {following.map((p) => (
                <PersonRow key={p.user_id} handle={p.handle} name={p.name} sub={p.program}>
                  <button
                    type="button"
                    onClick={() => void unfollowUser(p.handle).then(refresh)}
                    className="rounded-lg border border-border px-2.5 py-1.5 text-[12.5px] text-muted transition-colors duration-150 hover:border-danger hover:text-danger"
                  >
                    Unfollow
                  </button>
                </PersonRow>
              ))}
            </ul>
          )}
        </Section>
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
        {count > 0 && <span className="font-normal normal-case">{count}</span>}
      </h2>
      {children}
    </section>
  )
}

function PersonRow({
  handle,
  name,
  sub,
  children,
}: {
  handle: string
  name: string | null
  sub: string | null
  children: React.ReactNode
}) {
  return (
    <li className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2.5">
      <Initials name={name ?? handle} />
      <Link to={`/@${handle}`} className="min-w-0 flex-1 group">
        <span className="block truncate text-[13px] font-medium text-fg group-hover:underline">
          {name ?? handle}
        </span>
        <span className="block truncate text-[11.5px] text-subtle">
          @{handle}
          {sub ? ` · ${sub}` : ''}
        </span>
      </Link>
      <span className="flex shrink-0 items-center gap-1.5">{children}</span>
    </li>
  )
}

function Initials({ name }: { name: string }) {
  return (
    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-2 text-[11px] font-semibold text-muted">
      {name.slice(0, 2).toUpperCase()}
    </span>
  )
}

/** Nothing here is wrong — an empty inbox is a normal state, so it gets the
 *  mascot rather than a bare line of grey text. */
function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-5 py-8 text-center">
      <Mascot mood="resting" size="sm" soft className="text-accent" />
      <p className="text-[13px] font-medium text-fg">{title}</p>
      <p className="max-w-sm text-[12px] leading-relaxed text-subtle">{body}</p>
    </div>
  )
}
