import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Check,
  Clock,
  GraduationCap,
  Loader2,
  Search,
  Send,
  SlidersHorizontal,
  SquarePen,
  X,
} from 'lucide-react'
import { Mascot } from '@/components/Mascot'
import { VerifiedBadge } from '@/features/community/VerifiedBadge'
import { useCommunity } from '@/features/community/useCommunity'
import {
  acceptFriend,
  listFriends,
  type Friend,
  listThreads,
  markThreadRead,
  threadPreview,
  shortAgo,
  type Thread,
} from '@/lib/social'
import { cn } from '@/lib/cn'
import { useAuth } from '@/app/providers/auth'
import { Avatar, Chat } from './Chat'
import { OrgChat, OrgFace, type OrgChatTarget } from './OrgChat'
import { PersonMenu, PersonMenuButton, type PersonTarget } from './PersonMenu'
import { ScheduleAccess } from './ScheduleAccess'
import { useRecordSnapshot } from '@/features/planner/useRecordSnapshot'
import { badgeForPerson, type Badge } from './badges'
import { useCommunityData } from '@/app/providers/community-data'
import { useMessageTick } from '@/lib/message-alerts'
import { PullToRefresh } from '@/components/PullToRefresh'
import { NotesRow } from './NotesRow'
import { SearchOverlay } from '@/features/community/SearchOverlay'
import { MessageFilterSheet } from './MessageFilterSheet'
import { describeFilters, matchesFilters, type MessageFilterId } from './message-filters'
import { SupportConversation, SupportPane } from './SupportThreads'
import { useSupportThreads } from './use-support-threads'

/** Module-level so reading the clock is allowed (`react-hooks/purity` bars it
 *  inside a component body) — the same shape as `usageState` and `splitByTime`. */
const ago = (iso: string) => shortAgo(iso, Date.now())

/**
 * One line of the conversation list.
 *
 * The old row was a name over a handle, which is a CONTACTS list: it answers
 * "who do I know", and the reason anyone opens this screen is "who said
 * something". So: the last thing said, when, and a dot if it is waiting on
 * you.
 *
 * FOUR OR MORE UNREAD STOPS SHOWING THE TEXT. Past a few messages the preview
 * is a fragment of a conversation you are about to read anyway, and the count
 * is the more useful fact. It is also what every messenger does, which matters
 * here: a list like this is read by pattern, not by reading.
 *
 * An attachment names its KIND ("Sent a schedule") rather than the useless
 * "sent an attachment" — the point of the line is to say whether the thread
 * needs you, and "an attachment" cannot.
 */
/** The seal for a person, wherever their handle appears. One component so the
 *  colour and the label cannot differ between the DM list, the chat header and
 *  a follow row — which is how the founder ended up verified in one of them
 *  and not the others. */
function PersonSeal({ handle, userId, size }: { handle: string; userId: string; size: number }) {
  const { orgNameByOwner } = useCommunityData()
  const badge = badgeForPerson(handle, orgNameByOwner[userId])
  if (!badge) return null
  return <VerifiedBadge size={size} tone={badge.tone} label={badge.label} />
}

function ThreadLine({
  friend,
  thread,
  me,
  badge,
}: {
  friend: Friend
  thread: Thread | undefined
  me: string
  badge: Badge | undefined
}) {
  const unread = thread?.unread ?? 0
  const mine = !!thread?.last_sender && thread.last_sender === me
  const preview = thread
    ? unread >= 4
      ? `${unread}+ new messages`
      : threadPreview(thread, mine)
    : null

  return (
    <span className="flex min-w-0 flex-1 items-center gap-2">
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1 text-[14px] text-fg">
          <span className={cn('truncate', unread > 0 && 'font-semibold')}>
            {friend.name ?? friend.handle}
          </span>
          {badge && <VerifiedBadge size={12} tone={badge.tone} label={badge.label} />}
        </span>
        <span
          className={cn(
            'block truncate text-[12.5px]',
            unread > 0 ? 'font-medium text-fg' : 'text-subtle',
          )}
        >
          {/* No conversation yet is not the same as an empty one, and the
              handle is the only useful thing to say in that case. */}
          {preview ?? `@${friend.handle}`}
          {thread?.last_at && (
            <span className="font-normal text-subtle"> · {ago(thread.last_at)}</span>
          )}
        </span>
      </span>
      {unread > 0 && (
        <span
          className="size-2.5 shrink-0 rounded-full bg-accent"
          aria-label={`${unread} unread`}
        />
      )}
    </span>
  )
}

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
/**
 * FOLLOWING IS GONE AND SUPPORT HAS ITS PLACE.
 *
 * "Following" answered a question this screen is not for — it is the follow
 * graph, which lives on a profile — and it cost a permanent slot next to two
 * pills that are about conversations. Support IS a conversation: you write to
 * us, we write back, and until now the only way to read the reply was a
 * separate modal reached from the avatar menu. Two inboxes is one too many.
 */
type Pill = 'inbox' | 'requests' | 'support'

export function PeoplePanel() {
  const { orgNameByOwner } = useCommunityData()
  const [params, setParams] = useSearchParams()
  // `?people=requests` so a link can land on the right pill. Read ONCE as an
  // initial value: after that the pills are yours to click and the URL should
  // not drag you back. `messages` is the old name for `inbox`, still honoured.
  const [pill, setPill] = useState<Pill>(() => {
    const want = params.get('people')
    if (want === 'requests' || want === 'support') return want
    return 'inbox'
  })
  /** The lens over the list. Empty is the normal state; see message-filters.ts. */
  const [filters, setFilters] = useState<Set<MessageFilterId>>(() => new Set())
  const [filterOpen, setFilterOpen] = useState(false)
  const [friends, setFriends] = useState<Friend[] | null>(null)
  const [threads, setThreads] = useState<Thread[]>([])
  const { user: authUser } = useAuth()
  const meId = authUser?.id ?? ''
  const [active, setActive] = useState<Friend | null>(null)
  /**
   * A club conversation, held apart from `active`.
   *
   * `Friend` is a person — it carries a program, a follow state and a person
   * menu, none of which mean anything opposite an organisation. Dressing a
   * club up as one would have put a nullable branch on every consumer, so the
   * two open into the same slot and nothing else is shared.
   */
  const [activeOrg, setActiveOrg] = useState<OrgChatTarget | null>(null)
  /** A support ticket, open in the same slot. Held apart for the same reason
   *  `activeOrg` is: it is not a person and shares nothing but the pane. */
  const [activeTicket, setActiveTicket] = useState<string | null>(null)
  /** Feeds the "New messages" line; see the note on Chat's own prop. */
  const [unreadOnOpen, setUnreadOnOpen] = useState(0)
  const [tick, setTick] = useState(0)
  const [menu, setMenu] = useState<PersonTarget | null>(null)
  // Filters the thread list only. This is not the Community search — that one
  // finds strangers; this one finds a conversation you already have, which is
  // a different question and belongs on the list it narrows.
  const [threadQuery, setThreadQuery] = useState('')
  /** The compose button. Starting a conversation means finding somebody, and
   *  the overlay that finds people already exists. */
  const [composing, setComposing] = useState(false)
  const refresh = useCallback(() => setTick((n) => n + 1), [])
  /** Your support conversations, reloaded on the same beat as everything
   *  else on this screen — they are conversations and belong in the list. */
  const support = useSupportThreads(tick)
  /** Bumps when a message arrives anywhere, so the list reloads itself
   *  instead of waiting for a navigation. */
  const live = useMessageTick()

  useEffect(() => {
    let alive = true
    void listFriends().then((r) => alive && setFriends(r))
    void listThreads().then((r) => alive && setThreads(r))
    return () => {
      alive = false
    }
  }, [tick, live])

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

  const byOther = new Map(threads.map((t) => [t.other, t]))
  /*
   * Clubs you have written to. They cannot come from `my_friends` — that is
   * the follow graph between PEOPLE — so the thread list is their only source,
   * which is why it now carries the counterpart's name and logo on the row.
   */
  const orgThreads = threads.filter((t) => t.other_kind === 'org')
  /**
   * NEWEST FIRST. A message list ordered by when you became friends is a
   * contacts list; the whole reason to open this screen is "who said
   * something". Conversations that have never been used sort last, in their
   * existing order, rather than being hidden.
   */
  const accepted = [...(friends ?? [])]
    .filter((f) => f.status === 'accepted' || f.status === 'request')
    .sort((a, b) => {
      const ta = byOther.get(a.user_id)?.last_at ?? ''
      const tb = byOther.get(b.user_id)?.last_at ?? ''
      if (!ta && !tb) return 0
      if (!ta) return 1
      if (!tb) return -1
      return tb.localeCompare(ta)
    })
  const q = threadQuery.trim().toLowerCase()
  /*
   * SEARCH AND FILTERS BOTH NARROW, so both run over the same list in the
   * same place. Applying one of them at the call site and the other here is
   * how a list ends up showing a row the empty-state line has already said
   * does not exist.
   */
  const shownThreads = accepted.filter((f) => {
    if (q && !(f.handle.toLowerCase().includes(q) || (f.name ?? '').toLowerCase().includes(q)))
      return false
    const t = byOther.get(f.user_id)
    return matchesFilters(
      {
        kind: 'user',
        unread: t?.unread ?? 0,
        lastFromMe: t?.last_at ? t.last_from_me : undefined,
        lastBody: t?.last_body,
        verified: !!badgeForPerson(f.handle, orgNameByOwner[f.user_id]),
      },
      filters,
    )
  })
  const shownOrgThreads = orgThreads.filter((t) => {
    const name = `${t.other_name ?? ''} ${t.other_handle ?? ''}`.toLowerCase()
    if (q && !name.includes(q)) return false
    return matchesFilters(
      {
        kind: 'org',
        unread: t.unread,
        lastFromMe: t.last_at ? t.last_from_me : undefined,
        lastBody: t.last_body,
        // An organisation in the inbox is one you wrote to through its public
        // profile, and only a real account has one.
        verified: true,
      },
      filters,
    )
  })
  /*
   * SUPPORT LIVES UNDER ITS OWN PILL AND NOWHERE ELSE.
   *
   * It was in both, which is the duplicate-surface fault this tab keeps being
   * rebuilt to remove: the same rows in the list AND behind a filter whose
   * whole job is to isolate them. Writing to us is a conversation and belongs
   * in Messages — but it is a conversation with the product rather than with
   * a classmate, and mixing the two is what made one list read as two.
   */
  const shownSupport = support.tickets.filter(
    (t) => !q || t.subject.toLowerCase().includes(q) || t.case_id.toLowerCase().includes(q),
  )
  const nothingShown = shownThreads.length === 0 && shownOrgThreads.length === 0
  /**
   * WHAT IS WAITING ON YOU, under one relationship.
   *
   * `pending` is somebody who followed you and has not been followed back —
   * not a request in the old sense, because nobody needs your permission, but
   * still the one thing on this screen you might act on.
   *
   * `request` is a first message from somebody you are not mutual with. Those
   * rows have existed since message requests shipped and the UI never read
   * them: the inbox iterated accepted friendships, so a stranger's one message
   * was invisible to the person it was sent to.
   */
  const incoming = (friends ?? []).filter(
    (f) => f.status === 'pending' && f.direction === 'incoming',
  )
  const requests = (friends ?? []).filter((f) => f.status === 'request')

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
  const record = useRecordSnapshot()
  const initialAttachment = useMemo(() => {
    if (!attachParam) return undefined
    // `record` carries no id: it is a snapshot built here, not a pointer to a
    // row the recipient could never read.
    if (attachParam === 'record') {
      return record ? { kind: 'record' as const, snapshot: record } : undefined
    }
    const [kind, ...rest] = attachParam.split(':')
    const id = rest.join(':')
    if (!id) return undefined
    if (kind === 'event') {
      const e = events.find((x) => x.id === id)
      return { kind: 'event' as const, id, title: e?.title ?? 'Event' }
    }
    if (kind === 'course') return { kind: 'course' as const, code: id }
    return undefined
  }, [attachParam, events, record])

  /** Opening a ticket keeps you on the Support pill. It used to flip to the
   *  inbox, which is where the ticket rows used to be and no longer are —
   *  so the list you came from would have vanished under you. */
  const openTicket = (id: string) => {
    setActive(null)
    setActiveOrg(null)
    setActiveTicket(id)
  }

  const openOrgChat = (t: Thread) => {
    setActiveTicket(null)
    setActiveOrg({
      id: t.other,
      handle: t.other_handle ?? '',
      name: t.other_name ?? t.other_handle ?? 'Club',
      avatar: t.other_avatar,
      color: null,
      glyph: null,
      verified: false,
    })
    setActive(null)
    void markThreadRead(t.other)
  }

  const openChat = (f: Friend) => {
    setActiveOrg(null)
    setActiveTicket(null)
    setActive(f)
    // Remembered BEFORE the row is marked read, because marking it read is
    // what destroys the only evidence of where you left off.
    setUnreadOnOpen(byOther.get(f.user_id)?.unread ?? 0)
    // Clear the badge optimistically, then tell the server. Waiting for the
    // round trip leaves a dot on the conversation you are looking at.
    if ((byOther.get(f.user_id)?.unread ?? 0) > 0) {
      setThreads((prev) => prev.map((t) => (t.other === f.user_id ? { ...t, unread: 0 } : t)))
      void markThreadRead(f.user_id)
    }
    setPill('inbox')
    const next = new URLSearchParams(params)
    next.set('chat', f.handle)
    setParams(next, { replace: true })
  }

  const PILLS: { id: Pill; label: string; badge: number }[] = [
    { id: 'inbox', label: 'Inbox', badge: 0 },
    { id: 'requests', label: 'Requests', badge: incoming.length },
    { id: 'support', label: 'Support', badge: support.unread },
  ]

  const toggleFilter = (id: MessageFilterId) =>
    setFilters((prev) => {
      const next = new Set(prev)
      if (!next.delete(id)) next.add(id)
      return next
    })

  /** Waits for both loads, so the spinner stops when the list is genuinely
   *  current rather than when the request was sent. */
  const reload = () =>
    Promise.all([
      listFriends().then(setFriends).catch(() => {}),
      listThreads().then(setThreads).catch(() => {}),
    ]).then(() => undefined)

  const detailOpen = !!(active || activeOrg || activeTicket)

  return (
    /*
     * TWO PANES, NO CARD, NO PAGE SCROLL — the shape of a messenger rather
     * than a block sitting in a document.
     *
     * EVERYTHING THAT NARROWS THE LIST LIVES IN THE RAIL WITH IT: your
     * handle, the search, the notes, the filters. It used to span the full
     * width above both panes, which cost the conversation 300px of height
     * for controls that do nothing to it, and made the whole thing read as
     * a widget embedded in a page. A control belongs to the thing it acts
     * on — the same rule that emptied this tab of duplicate search boxes.
     *
     * THE RAIL IS THE ONLY SCROLL REGION on the left, and the conversation
     * owns its own on the right. Nothing above either of them moves, so the
     * composer cannot be pushed off the bottom of the screen.
     */
    <div className="flex min-h-0 flex-1">
      <div
        className={cn(
          'flex min-h-0 w-full shrink-0 flex-col border-border lg:w-[340px] lg:border-r',
          // On a phone there is one pane at a time: opening a conversation
          // replaces the list rather than sitting beside it.
          detailOpen && 'hidden lg:flex',
        )}
      >
        <div className="flex shrink-0 flex-col px-3 pt-2">
        {/*
          NO NAME ROW. It sat above everything announcing whose inbox this is,
          to the one person who cannot be in any doubt, and pushed every real
          control down a line to do it. Your handle is on the profile tab, in
          the sidebar footer, and in the URL.
        */}
        {/*
          THE ORDER IS THE REFERENCE'S: search, then notes, then filters, then
          the list. Search leads because it is what you reach for when you know
          who you want; the notes row sits under it because it is a glance, not
          a control; the filters sit directly on top of the thing they narrow.
        */}
        {/*
          THE TWO REFERENCES DISAGREE, and both are right for their own screen:
          on a phone the search sits above the filters, on desktop the tabs sit
          above the search. So the head is one flex column and each piece is
          ordered per breakpoint rather than duplicated into two trees that
          would drift.
        */}
        <div className="order-2 mb-1 flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search
              size={15}
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-subtle"
            />
            <input
              type="text"
              value={threadQuery}
              onChange={(e) => setThreadQuery(e.target.value)}
              placeholder="Search messages"
              aria-label="Search your conversations"
              className="w-full rounded-xl border border-transparent bg-surface-2 py-2 pr-8 pl-9 text-[13.5px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none"
            />
            {threadQuery && (
              <button
                type="button"
                aria-label="Clear"
                onClick={() => setThreadQuery('')}
                className="absolute top-1/2 right-2 grid size-5 -translate-y-1/2 place-items-center rounded text-subtle transition-colors duration-150 hover:text-fg"
              >
                <X size={13} aria-hidden />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => setComposing(true)}
            aria-label="New message"
            className="grid size-9 shrink-0 place-items-center rounded-full text-fg transition-colors duration-150 hover:bg-surface-2"
          >
            <SquarePen size={19} aria-hidden />
          </button>
        </div>

        <div className="order-3">
          <NotesRow />
        </div>

        {/* One scrolling row, edges not cut. Same treatment as the event filter
            chips, because it is the same kind of control. */}
        <div className="order-1 -mx-3 mb-2 overflow-x-auto px-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex w-max items-center gap-2" role="tablist">
            {/* IT IS A BUTTON NOW. It was a decorative glyph that looked
                exactly like a control, which is worse than no control. The
                count on it is the important half: a filter you have forgotten
                you set makes the app look like it has lost your messages. */}
            <button
              type="button"
              onClick={() => setFilterOpen(true)}
              aria-label={
                filters.size === 0 ? 'Filter conversations' : `Filters: ${describeFilters(filters)}`
              }
              className={cn(
                'relative grid size-8 shrink-0 place-items-center rounded-full transition-colors duration-150 active:scale-95',
                filters.size > 0
                  ? 'bg-accent text-accent-contrast'
                  : 'bg-surface-2 text-subtle hover:text-fg',
              )}
            >
              <SlidersHorizontal size={15} aria-hidden />
              {filters.size > 0 && (
                <span className="absolute -top-1 -right-1 grid size-4 place-items-center rounded-full bg-accent text-[9.5px] font-bold text-accent-contrast ring-2 ring-surface">
                  {filters.size}
                </span>
              )}
            </button>
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
        </div>

        <PullToRefresh onRefresh={reload} className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
          {friends === null && (
            <p className="flex items-center gap-2 py-10 text-[13px] text-subtle">
              <Loader2 size={15} className="animate-spin" aria-hidden />
              Loading
            </p>
          )}
          {friends !== null && pill === 'inbox' && (
            <>
              {accepted.length === 0 && orgThreads.length === 0 ? (
                <div className="lg:p-4">
                  <Empty
                    title="No conversations yet"
                    body="Open a classmate's profile and press Message. If they do not follow you back you get one message to say who you are."
                  />
                </div>
              ) : nothingShown ? (
                /* Says WHICH narrowing emptied the list, and offers the way
                   back. "Nothing here" next to a filter you set by accident is
                   a dead end. */
                <div className="px-3 py-8 text-center">
                  <p className="text-[12.5px] text-subtle">
                    {q && filters.size > 0
                      ? `No ${describeFilters(filters).toLowerCase()} conversation matching “${threadQuery.trim()}”.`
                      : q
                        ? `No conversation matching “${threadQuery.trim()}”.`
                        : `No ${describeFilters(filters).toLowerCase()} conversations.`}
                  </p>
                  {filters.size > 0 && (
                    <button
                      type="button"
                      onClick={() => setFilters(new Set())}
                      className="mt-2 text-[12.5px] font-medium text-accent"
                    >
                      Clear filters
                    </button>
                  )}
                </div>
              ) : (
                <ul className="divide-y divide-border lg:divide-y-0">
                  {shownOrgThreads.length > 0 && (
                    <li className="px-3 pt-2 pb-1 text-[10.5px] font-semibold tracking-wide text-subtle uppercase">
                      Clubs
                    </li>
                  )}
                  {shownOrgThreads.map((t) => (
                    <li
                      key={`org-${t.other}`}
                      className={cn(
                        'flex items-center pr-1 transition-colors duration-150',
                        activeOrg?.id === t.other ? 'lg:bg-accent-soft' : 'hover:bg-surface-2/60',
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => openOrgChat(t)}
                        className="flex min-w-0 flex-1 items-center gap-3 py-2.5 pr-1 pl-0.5 text-left lg:px-3"
                      >
                        <OrgFace
                          org={{
                            id: t.other,
                            handle: t.other_handle ?? '',
                            name: t.other_name ?? '',
                            avatar: t.other_avatar,
                            color: null,
                            glyph: null,
                            verified: false,
                          }}
                          className="size-11"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline gap-2">
                            <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-fg">
                              {t.other_name ?? t.other_handle}
                            </span>
                            {t.last_at && (
                              <span className="shrink-0 text-[11px] text-subtle">{ago(t.last_at)}</span>
                            )}
                          </span>
                          <span className="flex items-center gap-2">
                            <span
                              className={cn(
                                'min-w-0 flex-1 truncate text-[12.5px]',
                                t.unread > 0 ? 'font-medium text-fg' : 'text-subtle',
                              )}
                            >
                              {t.unread >= 4
                                ? `${t.unread} new messages`
                                : (t.last_from_me ? 'You: ' : '') + (t.last_body ?? '')}
                            </span>
                            {t.unread > 0 && (
                              <span className="size-2 shrink-0 rounded-full bg-accent" aria-hidden />
                            )}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                  {shownOrgThreads.length > 0 && shownThreads.length > 0 && (
                    <li className="px-3 pt-3 pb-1 text-[10.5px] font-semibold tracking-wide text-subtle uppercase">
                      People
                    </li>
                  )}
                  {shownThreads.map((f) => (
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
                        <ThreadLine
                          friend={f}
                          thread={byOther.get(f.user_id)}
                          me={meId}
                          badge={badgeForPerson(f.handle, orgNameByOwner[f.user_id])}
                        />
                      </button>
                      <PersonMenuButton onOpen={(at) => setMenu(targetFor(f, at))} />
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
          {friends !== null && pill === 'requests' && (
            <div className="space-y-5">
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto">
              {/* Empty sections do not render, and "Connected" is not one of them:
                  your existing connections are the Inbox, and listing them again
                  here is the same list twice under a different word. */}
              {incoming.length > 0 && (
                <Section title="Followed you" count={incoming.length}>
                  <ul className="space-y-2">
                    {incoming.map((f) => (
                      <PersonRow
                        key={f.friendship_id}
                        friend={f}
                        onMenu={(at) => setMenu(targetFor(f, at))}
                      >
                        <button
                          type="button"
                          onClick={() => void acceptFriend(f.handle).then(refresh)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-[12.5px] font-medium text-accent-contrast transition-colors duration-150 hover:bg-accent-hover"
                        >
                          <Check size={13} aria-hidden />
                          Follow back
                        </button>
                      </PersonRow>
                    ))}
                  </ul>
                </Section>
              )}

              {requests.length > 0 && (
                <Section title="Message requests" count={requests.length}>
                  <ul className="space-y-2">
                    {requests.map((f) => (
                      <PersonRow
                        key={f.friendship_id}
                        friend={f}
                        onMenu={(at) => setMenu(targetFor(f, at))}
                      >
                        <button
                          type="button"
                          onClick={() => openChat(f)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-[12.5px] font-medium text-accent-contrast transition-colors duration-150 hover:bg-accent-hover"
                        >
                          <Clock size={13} aria-hidden />
                          Read it
                        </button>
                      </PersonRow>
                    ))}
                  </ul>
                </Section>
              )}

              {incoming.length + requests.length === 0 && (
                <Empty
                  title="Nothing waiting"
                  body="A new follower, or a first message from someone you have not met, lands here."
                />
              )}
            </div>
            </div>
          )}
          {pill === 'support' && (
            <div className="min-h-0 flex-1 overflow-y-auto">
              <SupportPane
                tickets={shownSupport}
                loading={support.loading}
                activeId={activeTicket}
                onOpen={openTicket}
              />
            </div>
          )}
        </PullToRefresh>
      </div>

      {/*
        THE CONVERSATION. A row, because an open DM also carries the person
        panel beside it on a wide screen. On a phone it takes the whole
        screen: `h-[100dvh]` rather than `inset-0`, since `inset-0` sizes to
        the LAYOUT viewport, which does not move with the browser chrome and
        leaves the composer behind the URL bar. Safe-area padding at both
        ends because `viewport-fit=cover` puts us under the notch and the
        home indicator on purpose.
      */}
      <div
        className={cn(
          'min-h-0 flex-1',
          detailOpen
            ? 'fixed inset-x-0 top-0 z-50 flex h-[100dvh] bg-canvas pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] lg:static lg:z-auto lg:h-auto lg:bg-transparent lg:pt-0 lg:pb-0'
            : 'hidden lg:flex',
        )}
      >
            {activeTicket ? (
              <SupportConversation
                ticket={support.tickets.find((t) => t.id === activeTicket)}
                onBack={() => setActiveTicket(null)}
                onReplied={refresh}
              />
            ) : activeOrg ? (
              <OrgChat org={activeOrg} onBack={() => setActiveOrg(null)} />
            ) : active ? (
              <>
                <Chat
                  friend={active}
                  onBack={() => setActive(null)}
                  initialAttachment={initialAttachment}
                  unreadOnOpen={unreadOnOpen}
                />
                {/* Who you are talking to, without leaving the conversation. */}
                <aside className="hidden w-56 shrink-0 border-l border-border p-4 xl:block">
                  <Avatar friend={active} size={64} />
                  <p className="mt-2.5 flex items-center gap-1 text-[14px] font-medium text-fg">
                    <span className="min-w-0 truncate">{active.name ?? active.handle}</span>
                    <PersonSeal handle={active.handle} userId={active.user_id} size={14} />
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
                  {/* "When are you free" is the single most asked question in
                      these threads, so the answer to it belongs beside the
                      conversation rather than one page away. */}
                  <ScheduleAccess handle={active.handle} name={active.name} compact />
                </aside>
              </>
            ) : (
              accepted.length > 0 && (
                /* The reference's empty pane: a mark, a title, one line, and the
                   action. The paragraph that used to live here explained the
                   attachment menu to somebody who had not opened a conversation
                   yet — the wrong thing at the wrong moment, and it left the
                   largest area on the screen reading as an error message. */
                <div className="hidden flex-1 flex-col items-center justify-center gap-3 p-6 text-center lg:flex">
                  <span className="grid size-24 place-items-center rounded-full border-2 border-fg/85">
                    <Send size={38} className="-ml-1 text-fg/85" aria-hidden />
                  </span>
                  <div>
                    <p className="text-[19px] font-medium text-fg">Your messages</p>
                    <p className="mt-1 text-[13.5px] text-subtle">Send a message to start a chat.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setComposing(true)}
                    className="mt-1 rounded-lg bg-accent px-4 py-2 text-[13px] font-semibold text-accent-contrast transition-colors duration-150 hover:bg-accent-hover"
                  >
                    Send message
                  </button>
                </div>
              )
            )}
      </div>

      {composing && <SearchOverlay onClose={() => setComposing(false)} />}
      {filterOpen && (
        <MessageFilterSheet
          active={filters}
          onToggle={toggleFilter}
          onClear={() => setFilters(new Set())}
          onClose={() => setFilterOpen(false)}
        />
      )}
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
      <Avatar friend={friend} size={36} />
      <Link to={`/@${friend.handle}`} className="group min-w-0 flex-1">
        <span className="flex items-center gap-1 text-[13px] font-medium text-fg group-hover:underline">
          <span className="truncate">{friend.name ?? friend.handle}</span>
          <PersonSeal handle={friend.handle} userId={friend.user_id} size={13} />
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
    connected: f.status === 'accepted',
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
