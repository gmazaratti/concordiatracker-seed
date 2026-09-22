import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BookOpen,
  CalendarRange,
  Check,
  CheckCheck,
  ChevronLeft,
  GraduationCap,
  Palette,
  PartyPopper,
  Plus,
  Send,
} from 'lucide-react'
import { useAppData } from '@/app/providers/app-data'
import { useUiState } from '@/app/providers/ui-state'
import { useSettings } from '@/app/providers/settings'
import { supabase } from '@/lib/supabase'
import { listSchedules, type SavedSchedule } from '@/lib/schedules'
import { useCommunity } from '@/features/community/useCommunity'
import { VerifiedBadge } from '@/features/community/VerifiedBadge'
import { badgeForPerson } from './badges'
import { useCommunityData } from '@/app/providers/community-data'
import { CHAT_THEMES, chatTheme } from './chat-themes'
import {
  listMessages,
  markRead,
  sendMessage,
  type Attachment,
  type Friend,
  type Message,
  type SharedClass,
} from '@/lib/social'
import type { SectionOption } from '@/lib/seats'
import { placeSections, weeklyHours } from '@/features/planner/schedule'
import { AttachmentEmbed } from './AttachmentEmbed'
import { setOpenThread } from '@/lib/message-toast'
import { useRecordSnapshot } from '@/features/planner/useRecordSnapshot'
import { cn } from '@/lib/cn'

/**
 * One conversation.
 *
 * The thing students actually want from a chat inside a school app is not
 * chat — it is sending each other the objects the app already holds. "When are
 * your classes", "send me that outline", "are you going to this". So the
 * composer leads with a + that attaches a REFERENCE to a schedule, a class or
 * an event, and the recipient opens the live thing rather than a screenshot
 * that stopped being true in March.
 *
 * Everything that could be faked is not: read receipts come from `read_at` on
 * the row, and typing is a broadcast that carries no history and is never
 * stored. A chat that invents either is a chat you stop believing.
 */
export function Chat({
  friend,
  onBack,
  initialAttachment,
  unreadOnOpen = 0,
  className,
}: {
  friend: Friend
  onBack?: () => void
  /**
   * How many of theirs were unread the moment you opened this, counted by the
   * list that opened it.
   *
   * IT CANNOT BE DERIVED HERE. Opening a conversation marks it read — the
   * list does it optimistically so the badge clears instantly, and this
   * component does it again on load — so by the time the messages arrive
   * `read_at` is already set on every one of them and there is nothing left
   * to divide. The count has to be carried in from before that happened.
   */
  unreadOnOpen?: number
  /** Pre-loaded from a Share button elsewhere, so "send this to a friend"
   *  lands in the composer rather than making you find it again in the +. */
  initialAttachment?: Attachment
  className?: string
}) {
  const { courses, plan } = useAppData()
  const { uiState, patchUiState } = useUiState()
  const { openSettings } = useSettings()
  const { events } = useCommunity()

  const [rows, setRows] = useState<Message[] | null>(null)
  const [body, setBody] = useState('')
  const [pending, setPending] = useState<Attachment | null>(initialAttachment ?? null)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const [schedules, setSchedules] = useState<SavedSchedule[]>([])
  const [me, setMe] = useState<string | null>(null)
  const [attachOpen, setAttachOpen] = useState(false)
  const [themeOpen, setThemeOpen] = useState(false)
  const [theyType, setTheyType] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const typingSentAt = useRef(0)

  const theme = chatTheme(uiState.chatThemes?.[friend.user_id])
  const pro = plan !== 'free'
  const { orgNameByOwner } = useCommunityData()
  const badge = badgeForPerson(friend.handle, orgNameByOwner[friend.user_id])

  /**
   * While this conversation is on screen, its messages do not raise the
   * in-app banner. A banner for a message you are watching arrive is noise,
   * and it covers the top of the thread you are reading.
   */
  useEffect(() => {
    setOpenThread(friend.user_id)
    return () => setOpenThread(null)
  }, [friend.user_id])

  useEffect(() => {
    let alive = true
    void (async () => {
      const [msgs, saved, auth] = await Promise.all([
        listMessages(friend.user_id),
        listSchedules(),
        supabase.auth.getUser(),
      ])
      if (!alive) return
      setRows(msgs)
      setSchedules(saved)
      setMe(auth.data.user?.id ?? null)
      void markRead(friend.user_id)
    })()
    return () => {
      alive = false
    }
  }, [friend.user_id, tick])

  /**
   * New messages, and whether they are typing.
   *
   * Postgres changes give us the message; a broadcast gives us the typing,
   * because "someone is typing" is worth nothing a second later and has no
   * business being a row in a table. The channel name is the ORDERED pair, so
   * both sides land in the same room without either having to be the host.
   */
  useEffect(() => {
    if (!me) return
    const pair = [me, friend.user_id].sort().join('_')
    let clear: ReturnType<typeof setTimeout> | undefined

    const channel = supabase
      .channel(`chat_${pair}`)
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if ((payload as { from?: string })?.from !== friend.user_id) return
        setTheyType(true)
        clearTimeout(clear)
        // Self-clearing: a "stopped typing" event that never arrives (a closed
        // tab, a dropped connection) would leave the bubble up forever.
        clear = setTimeout(() => setTheyType(false), 4000)
      })
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const row = payload.new as Message
          const mine = row.sender === me && row.recipient === friend.user_id
          const theirs = row.sender === friend.user_id && row.recipient === me
          if (!mine && !theirs) return
          setTheyType(false)
          setTick((n) => n + 1)
        },
      )
      .subscribe()

    return () => {
      clearTimeout(clear)
      void supabase.removeChannel(channel)
    }
  }, [me, friend.user_id])

  useEffect(() => {
    /*
     * The CONTAINER is scrolled, not the element scrolled into view.
     * `scrollIntoView` walks up and scrolls EVERY scrollable ancestor, so on
     * desktop sending a message dragged the whole page down and took the
     * composer off the bottom of the screen with it.
     */
    const box = endRef.current?.parentElement
    if (box) box.scrollTop = box.scrollHeight
  }, [rows, theyType])

  /**
   * WHERE YOU LEFT OFF.
   *
   * Frozen the first time a conversation loads, and deliberately not
   * recomputed: opening the thread marks it read, and a message that arrives
   * while you are looking at it is not one you missed. Recomputing from
   * `read_at` on every refetch would drop a second divider above every live
   * message, which is the opposite of what the line is for.
   */
  const [divider, setDivider] = useState<{ friend: string; id: string | null }>({
    friend: '',
    id: null,
  })
  if (rows && divider.friend !== friend.user_id) {
    // Walk back from the newest, counting only THEIRS, until the count they
    // were unread by is used up. That message is the first one you had not
    // seen.
    let left = unreadOnOpen
    let at: string | null = null
    for (let i = rows.length - 1; i >= 0 && left > 0; i--) {
      if (rows[i].sender === me) continue
      left -= 1
      if (left === 0) at = rows[i].id
    }
    // Nothing above it to divide from means nothing to draw.
    setDivider({ friend: friend.user_id, id: at && rows[0]?.id !== at ? at : null })
  }

  function announceTyping() {
    if (!me) return
    // Throttled: one ping every two seconds is enough to hold a bubble open,
    // and a broadcast per keystroke is a lot of traffic for a dot animation.
    const now = Date.now()
    if (now - typingSentAt.current < 2000) return
    typingSentAt.current = now
    const pair = [me, friend.user_id].sort().join('_')
    void supabase
      .channel(`chat_${pair}`)
      .send({ type: 'broadcast', event: 'typing', payload: { from: me } })
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!body.trim() && !pending) return
    const msg = await sendMessage(friend.user_id, body || ' ', pending ?? undefined)
    if (msg) return setError(msg)
    setBody('')
    setPending(null)
    setError(null)
    setTick((n) => n + 1)
  }

  /**
   * Everything you can send, grouped by what it is.
   *
   * `now` is read once into state rather than during render: the clock is
   * impure, and a memo that re-derives "upcoming" on every re-render can drop
   * an event out of the list mid-scroll.
   */
  const [now] = useState(() => Date.now())

  // Built by the same hook the export sheet uses, so what you send and what
  // you print cannot drift apart.
  const record = useRecordSnapshot()

  /** This term, in the shape a sent schedule carries. */
  const currentClasses = useMemo(
    () =>
      courses
        .filter((c) => c.code.trim())
        .map((c) => ({
          code: c.code,
          meets: c.meetingTimes,
          room: c.location || undefined,
          section: c.section || undefined,
        })),
    [courses],
  )
  const attachables = useMemo(() => {
    const term = courses.filter((c) => c.code.trim())
    const upcoming = events.filter((e) => new Date(e.start).getTime() > now).slice(0, 6)
    return { term, schedules, upcoming }
  }, [courses, schedules, events, now])

  return (
    <div
      className={cn('flex min-h-0 flex-1 flex-col', className)}
      style={theme.bg ? { backgroundColor: theme.bg } : undefined}
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex shrink-0 items-center gap-2.5 border-b border-border/70 px-3 py-2.5">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to conversations"
            className="-ml-1 grid size-8 shrink-0 place-items-center rounded-full text-fg transition-colors duration-150 hover:bg-surface-2 lg:hidden"
          >
            <ChevronLeft size={22} aria-hidden />
          </button>
        )}
        <Avatar friend={friend} size={34} />
        <div className="min-w-0 flex-1">
          <Link
            to={`/@${friend.handle}`}
            className="flex items-center gap-1 text-[13.5px] font-medium text-fg hover:underline"
          >
            <span className="truncate">{friend.name ?? friend.handle}</span>
            {badge && <VerifiedBadge size={14} tone={badge.tone} label={badge.label} />}
          </Link>
          <p className="truncate text-[11.5px] text-subtle">@{friend.handle}</p>
        </div>

        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => (pro ? setThemeOpen((o) => !o) : openSettings('billing'))}
            aria-label="Chat colours"
            title={pro ? 'Chat colours' : 'Chat colours come with the Semester pass'}
            className="grid size-8 place-items-center rounded-lg text-subtle transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
          >
            <Palette size={15} aria-hidden />
          </button>
          {themeOpen && (
            <div className="ct-animate-pop absolute top-full right-0 z-30 mt-1.5 w-[212px] rounded-xl border border-border bg-surface p-2.5 shadow-2xl">
              <p className="mb-2 px-0.5 text-[11px] text-subtle">
                Just for you — they see their own.
              </p>
              <div className="grid grid-cols-3 gap-2">
                {CHAT_THEMES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      patchUiState({
                        chatThemes: { ...uiState.chatThemes, [friend.user_id]: t.id },
                      })
                      setThemeOpen(false)
                    }}
                    aria-label={t.label}
                    title={t.label}
                    className={cn(
                      'h-11 overflow-hidden rounded-lg border transition-transform duration-150 hover:scale-105',
                      theme.id === t.id ? 'border-accent' : 'border-border',
                    )}
                    style={{ backgroundColor: t.bg || 'var(--ct-canvas)' }}
                  >
                    <span
                      className="mx-auto mt-4 block h-3 w-8 rounded-full"
                      style={{ backgroundColor: t.bubble || 'var(--ct-accent)' }}
                    />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Messages ───────────────────────────────────────────────────── */}
      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-3 py-3">
        {rows === null && <p className="text-[12px] text-subtle">Loading…</p>}
        {rows?.length === 0 && (
          <p className="py-8 text-center text-[12px] text-subtle">
            Nothing here yet. Send them your schedule with the + below.
          </p>
        )}
        {(rows ?? []).map((m, i) => {
          const mine = m.sender === me
          const prev = (rows ?? [])[i - 1]
          const next = (rows ?? [])[i + 1]
          // Only the last of a run gets a tail and a timestamp, so a burst of
          // three reads as one thought rather than three notifications.
          const grouped = prev?.sender === m.sender
          /**
           * THE AVATAR BELONGS ON THE LAST MESSAGE OF A RUN, not the first.
           *
           * The row is `items-end`, so the face sits level with the bottom
           * bubble — which is where the eye already is after reading three
           * messages downward, and where every messenger puts it. On the first
           * message it floats level with the top of a block it is not the end
           * of, and the run reads as starting from nowhere.
           */
          const endsRun = next?.sender !== m.sender
          const last = i === (rows ?? []).length - 1
          return (
            <Fragment key={m.id}>
              {divider.id === m.id && (
                <div className="flex items-center gap-3 py-2" role="separator">
                  <span className="h-px flex-1 bg-border" />
                  <span className="text-[11px] font-medium tracking-wide text-subtle">
                    New messages
                  </span>
                  <span className="h-px flex-1 bg-border" />
                </div>
              )}
            <div
              className={cn(
                'ct-msg-in flex items-end gap-2',
                mine ? 'justify-end' : 'justify-start',
                grouped ? 'mt-0.5' : 'mt-2',
              )}
            >
              {!mine && (
                <span className={cn('shrink-0', !endsRun && 'invisible')}>
                  <Avatar friend={friend} size={24} />
                </span>
              )}
              <div className="max-w-[78%]">
                {/* A card sent on its own carries no bubble. An attachment
                    inside a coloured pill draws a ring around the card and
                    reads as a mistake — iMessage does the same with a link
                    preview, for the same reason. */}
                {m.body.trim() ? (
                  <div
                    className={cn(
                      'rounded-2xl px-3 py-2',
                      mine
                        ? 'rounded-br-md bg-accent text-accent-contrast'
                        : 'rounded-bl-md border border-border bg-surface-2 text-fg',
                    )}
                    style={
                      mine && theme.bubble
                        ? { backgroundColor: theme.bubble, color: theme.bubbleText }
                        : undefined
                    }
                  >
                    <p className="text-[12.5px] leading-relaxed whitespace-pre-wrap">{m.body}</p>
                    {m.attachment && <AttachmentEmbed attachment={m.attachment} mine={mine} />}
                  </div>
                ) : (
                  m.attachment && <AttachmentEmbed attachment={m.attachment} mine={mine} bare />
                )}
                {/* Receipts on YOUR last message only. A tick under every line
                    is clutter, and under theirs it is meaningless. */}
                {mine && last && (
                  <p className="mt-0.5 flex items-center justify-end gap-1 text-[10.5px] text-subtle">
                    {m.read_at ? (
                      <>
                        <CheckCheck size={11} aria-hidden />
                        Read
                      </>
                    ) : (
                      <>
                        <Check size={11} aria-hidden />
                        Sent
                      </>
                    )}
                  </p>
                )}
              </div>
            </div>
            </Fragment>
          )
        })}

        {theyType && (
          <div className="ct-msg-in flex items-end gap-2">
            <Avatar friend={friend} size={24} />
            <div className="rounded-2xl rounded-bl-md border border-border bg-surface-2 px-3 py-2.5">
              <span className="flex items-center gap-1" aria-label="Typing">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="ct-typing-dot size-1.5 rounded-full bg-subtle"
                    style={{ animationDelay: `${i * 160}ms` }}
                  />
                ))}
              </span>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* ── Composer ───────────────────────────────────────────────────── */}
      {/*
        PINNED. `shrink-0` inside a column whose middle is the only thing that
        scrolls — so a long conversation can never push the box off the bottom
        of the screen, which it used to do on desktop because `scrollIntoView`
        scrolled the page as well as the list.
      */}
      <form onSubmit={submit} className="shrink-0 border-t border-border/70 p-2.5">
        {pending && (
          <div className="ct-animate-pop mb-2 flex items-center gap-2 rounded-lg border border-accent/40 bg-accent-soft px-2.5 py-1.5">
            <span className="min-w-0 flex-1 truncate text-[11.5px] text-fg">
              {describe(pending)}
            </span>
            <button
              type="button"
              onClick={() => setPending(null)}
              className="text-[11px] text-subtle hover:text-fg"
            >
              Remove
            </button>
          </div>
        )}

        <div className="flex items-end gap-2">
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setAttachOpen((o) => !o)}
              aria-label="Send something"
              aria-expanded={attachOpen}
              className={cn(
                'grid size-9 place-items-center rounded-full border border-border text-muted transition-all duration-200 hover:border-accent hover:text-fg',
                attachOpen && 'rotate-45 border-accent text-accent',
              )}
            >
              <Plus size={16} aria-hidden />
            </button>

            {attachOpen && (
              <div className="ct-animate-pop absolute bottom-full left-0 z-30 mb-2 max-h-[320px] w-[248px] overflow-y-auto rounded-xl border border-border bg-surface p-2 shadow-2xl">
                <AttachGroup label="Your schedule">
                  <AttachRow
                    icon={CalendarRange}
                    label="This semester"
                    hint={`${attachables.term.length} classes`}
                    onPick={() => {
                      setPending(snapshotOf('current', 'My current schedule', currentClasses))
                      setAttachOpen(false)
                    }}
                  />
                  {attachables.schedules.map((s) => (
                    <AttachRow
                      key={s.id}
                      icon={CalendarRange}
                      label={s.name}
                      hint={`${(s.sections ?? []).length} classes`}
                      onPick={() => {
                        setPending(
                          snapshotOf(
                            s.id,
                            s.name,
                            (s.sections ?? []).map((p) => ({
                              code: p.code,
                              meets: p.section.meetingTimes ?? '',
                              room: p.section.building
                                ? `${p.section.building} ${p.section.room}`.trim()
                                : p.section.room || undefined,
                              section: p.section.section,
                            })),
                          ),
                        )
                        setAttachOpen(false)
                      }}
                    />
                  ))}
                </AttachGroup>

                {record && record.courseCount > 0 && (
                  <AttachGroup label="Your record">
                    <AttachRow
                      icon={GraduationCap}
                      label="My record"
                      hint={`${record.credits} credits${record.gpa === null ? '' : ` · GPA ${record.gpa.toFixed(2)}`}`}
                      onPick={() => {
                        setPending({ kind: 'record', snapshot: record })
                        setAttachOpen(false)
                      }}
                    />
                  </AttachGroup>
                )}

                {attachables.term.length > 0 && (
                  <AttachGroup label="A class">
                    {attachables.term.map((c) => (
                      <AttachRow
                        key={c.id}
                        icon={BookOpen}
                        label={c.code || 'Course'}
                        hint={c.title}
                        onPick={() => {
                          setPending({
                            kind: 'course',
                            code: c.code,
                            title: c.title,
                            color: c.color,
                            credits: c.credits,
                          })
                          setAttachOpen(false)
                        }}
                      />
                    ))}
                  </AttachGroup>
                )}

                {attachables.upcoming.length > 0 && (
                  <AttachGroup label="An event">
                    {attachables.upcoming.map((e) => (
                      <AttachRow
                        key={e.id}
                        icon={PartyPopper}
                        label={e.title}
                        hint={e.org.name}
                        onPick={() => {
                          setPending({ kind: 'event', id: e.id, title: e.title })
                          setAttachOpen(false)
                        }}
                      />
                    ))}
                  </AttachGroup>
                )}
              </div>
            )}
          </div>

          {/* ONE PILL holding the text and the send, the shape every
              messenger a student already uses puts here. The button inside it
              rather than beside it is what makes the row read as a single
              field instead of three controls in a line, and it keeps the
              tap target at the thumb's end of the bar. */}
          <div className="flex min-w-0 flex-1 items-end gap-1 rounded-[20px] border border-border bg-canvas py-1 pr-1 pl-3.5 transition-colors duration-150 focus-within:border-accent">
            <textarea
              value={body}
              onChange={(e) => {
                setBody(e.target.value)
                announceTyping()
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void submit(e as unknown as React.FormEvent)
                }
              }}
              rows={1}
              placeholder={`Message ${friend.name ?? friend.handle}`}
              className="max-h-28 min-h-[28px] flex-1 resize-none self-center bg-transparent py-1 text-[13.5px] text-fg placeholder:text-subtle focus:outline-none"
            />
            <button
              type="submit"
              aria-label="Send"
              disabled={!body.trim() && !pending}
              className="grid size-8 shrink-0 place-items-center rounded-full bg-accent text-accent-contrast transition-all duration-150 hover:bg-accent-hover disabled:bg-transparent disabled:text-subtle"
            >
              <Send size={15} aria-hidden />
            </button>
          </div>
        </div>
        {error && <p className="mt-1.5 text-[11.5px] text-warning">{error}</p>}
      </form>
    </div>
  )
}

export function Avatar({ friend, size = 32 }: { friend: Friend; size?: number }) {
  if (friend.avatar_url) {
    return (
      <img
        src={friend.avatar_url}
        alt=""
        width={size}
        height={size}
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
        // A dead avatar URL hides itself rather than showing a broken image;
        // the initials tile underneath is the fallback everywhere else too.
        onError={(e) => {
          e.currentTarget.style.display = 'none'
        }}
      />
    )
  }
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full bg-surface-2 font-semibold text-muted"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
    >
      {(friend.name ?? friend.handle).slice(0, 2).toUpperCase()}
    </span>
  )
}

function AttachGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-2 last:mb-0">
      <p className="px-1.5 pb-1 text-[10.5px] font-semibold tracking-wide text-subtle uppercase">
        {label}
      </p>
      {children}
    </div>
  )
}

function AttachRow({
  icon: Icon,
  label,
  hint,
  onPick,
}: {
  icon: typeof BookOpen
  label: string
  hint?: string
  onPick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      className="flex w-full items-center gap-2 rounded-lg px-1.5 py-1.5 text-left transition-colors duration-150 hover:bg-surface-2"
    >
      <Icon size={13} className="shrink-0 text-accent" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12px] text-fg">{label}</span>
        {hint && <span className="block truncate text-[10.5px] text-subtle">{hint}</span>}
      </span>
    </button>
  )
}

/**
 * A schedule, frozen at the moment it was sent.
 *
 * Unlike a course or an event, a schedule row is private — a reference to one
 * is unreadable to the person you sent it to and would render as an empty box.
 * It is also not what sending a timetable is FOR: people screenshot these so a
 * friend can glance at them later, and a snapshot is the honest version of that
 * screenshot. Stamped with the date so it can never pass for live.
 */
function snapshotOf(id: string, name: string, classes: SharedClass[]): Attachment {
  const placed = placeSections(
    classes.map((c) => ({
      code: c.code,
      section: { meetingTimes: c.meets } as SectionOption,
    })),
  )
  return {
    kind: 'schedule',
    id,
    name,
    classes,
    sentAt: new Date().toISOString(),
    hours: weeklyHours(placed),
  }
}

function describe(a: Attachment): string {
  if (a.kind === 'schedule') return `Schedule · ${a.name}`
  if (a.kind === 'course') return `Class · ${a.code}`
  if (a.kind === 'event') return `Event · ${a.title}`
  if (a.kind === 'record') return `Record · ${a.snapshot.credits} credits`
  if (a.kind === 'schedule_request') return 'Schedule request'
  return `Outline · ${a.code}`
}
