import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BookOpen,
  CalendarRange,
  Check,
  CheckCheck,
  ExternalLink,
  FileText,
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
import { founderFor } from './founders'
import { CHAT_THEMES, chatTheme } from './chat-themes'
import {
  listMessages,
  markRead,
  sendMessage,
  type Attachment,
  type Friend,
  type Message,
} from '@/lib/social'
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
  className,
}: {
  friend: Friend
  onBack?: () => void
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
  const founder = founderFor(friend.handle)

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
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [rows, theyType])

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
            className="rounded px-1 text-[13px] text-muted transition-colors hover:text-fg lg:hidden"
          >
            ←
          </button>
        )}
        <Avatar friend={friend} size={34} />
        <div className="min-w-0 flex-1">
          <Link
            to={`/@${friend.handle}`}
            className="flex items-center gap-1 text-[13.5px] font-medium text-fg hover:underline"
          >
            <span className="truncate">{friend.name ?? friend.handle}</span>
            {founder && <VerifiedBadge size={14} />}
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
          // Only the last of a run gets a tail and a timestamp, so a burst of
          // three reads as one thought rather than three notifications.
          const grouped = prev?.sender === m.sender
          const last = i === (rows ?? []).length - 1
          return (
            <div
              key={m.id}
              className={cn(
                'ct-msg-in flex items-end gap-2',
                mine ? 'justify-end' : 'justify-start',
                grouped ? 'mt-0.5' : 'mt-2',
              )}
            >
              {!mine && (
                <span className={cn('shrink-0', grouped && 'invisible')}>
                  <Avatar friend={friend} size={24} />
                </span>
              )}
              <div className="max-w-[78%]">
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
                  {m.body.trim() && (
                    <p className="text-[12.5px] leading-relaxed whitespace-pre-wrap">{m.body}</p>
                  )}
                  {m.attachment && <AttachmentCard attachment={m.attachment} mine={mine} />}
                </div>
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
                      setPending({ kind: 'schedule', id: 'current', name: 'My current schedule' })
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
                        setPending({ kind: 'schedule', id: s.id, name: s.name })
                        setAttachOpen(false)
                      }}
                    />
                  ))}
                </AttachGroup>

                {attachables.term.length > 0 && (
                  <AttachGroup label="A class">
                    {attachables.term.map((c) => (
                      <AttachRow
                        key={c.id}
                        icon={BookOpen}
                        label={c.code || 'Course'}
                        hint={c.title}
                        onPick={() => {
                          setPending({ kind: 'course', code: c.code, title: c.title })
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
            className="min-h-[38px] flex-1 resize-none rounded-2xl border border-border bg-canvas px-3.5 py-2 text-[13px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none"
          />
          <button
            type="submit"
            aria-label="Send"
            disabled={!body.trim() && !pending}
            className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-accent-contrast transition-all duration-150 hover:bg-accent-hover disabled:opacity-40"
          >
            <Send size={15} aria-hidden />
          </button>
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

function describe(a: Attachment): string {
  if (a.kind === 'schedule') return `Schedule · ${a.name}`
  if (a.kind === 'course') return `Class · ${a.code}`
  if (a.kind === 'event') return `Event · ${a.title}`
  return `Outline · ${a.code}`
}

/** A link to the live thing, never a copy — so a shared schedule shows what it
 *  says today rather than what it said in March. */
function AttachmentCard({ attachment, mine }: { attachment: Attachment; mine: boolean }) {
  const Icon =
    attachment.kind === 'schedule'
      ? CalendarRange
      : attachment.kind === 'course'
        ? BookOpen
        : attachment.kind === 'event'
          ? PartyPopper
          : FileText
  const to =
    attachment.kind === 'schedule'
      ? '/app/planner?tab=schedule'
      : attachment.kind === 'course'
        ? '/app/courses'
        : attachment.kind === 'event'
          ? `/app/community?event=${attachment.id}`
          : '/app/courses/blueprints'
  return (
    <Link
      to={to}
      className={cn(
        'mt-1.5 flex items-center gap-2 rounded-xl px-2.5 py-2 text-[11.5px] transition-opacity hover:opacity-85',
        mine ? 'bg-black/20' : 'border border-border bg-canvas',
      )}
    >
      <Icon size={14} className="shrink-0" aria-hidden />
      <span className="min-w-0 flex-1 truncate">{describe(attachment)}</span>
      <ExternalLink size={11} className="shrink-0 opacity-70" aria-hidden />
    </Link>
  )
}
