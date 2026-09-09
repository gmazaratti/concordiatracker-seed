import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarRange, BookOpen, FileText, Loader2, Send, Users } from 'lucide-react'
import { ModalShell } from '@/command/ModalShell'
import { useAppData } from '@/app/providers/app-data'
import { listSchedules, type SavedSchedule } from '@/lib/schedules'
import {
  listFriends,
  listMessages,
  markRead,
  sendMessage,
  type Attachment,
  type Friend,
  type Message,
} from '@/lib/social'
import { cn } from '@/lib/cn'

/**
 * Messages, for the one thing students actually text each other about.
 *
 * Not a chat app. The reason this exists is that "when are your classes" and
 * "send me that outline" are asked constantly and answered badly — a screenshot
 * that goes stale the moment a section changes. So a message can carry a
 * REFERENCE to a schedule, a class or a blueprint, and the recipient opens the
 * live thing rather than a picture of it.
 *
 * You can only message accepted friends, and that is enforced in the insert
 * policy rather than here: there is no version of this app, or of a script
 * pointed at our API, that can cold-message a stranger.
 */
export function MessagesModal({
  startWith,
  onClose,
}: {
  /** Open straight into a conversation, from a profile's Message button. */
  startWith?: Friend
  onClose: () => void
}) {
  const [friends, setFriends] = useState<Friend[] | null>(null)
  const [active, setActive] = useState<Friend | null>(startWith ?? null)

  useEffect(() => {
    let alive = true
    void listFriends().then((rows) => {
      if (!alive) return
      setFriends(rows.filter((f) => f.status === 'accepted'))
    })
    return () => {
      alive = false
    }
  }, [])

  return (
    <ModalShell label="Messages" onClose={onClose} widthClass="sm:max-w-2xl" scroll={false}>
      <div className="flex h-[70vh] min-h-0 flex-col sm:h-[560px] sm:flex-row">
        {/* On a phone the list gives way to the conversation entirely — two
            panels in 375px is two unusable panels. */}
        <aside
          className={cn(
            'min-h-0 shrink-0 overflow-y-auto border-border sm:w-56 sm:border-r',
            active ? 'hidden sm:block' : 'flex-1 sm:flex-none',
          )}
        >
          <p className="px-3 py-2.5 text-[11px] font-semibold tracking-wide text-subtle uppercase">
            Friends
          </p>
          {friends === null && (
            <p className="px-3 text-[12px] text-subtle">
              <Loader2 size={13} className="mr-1 inline animate-spin" aria-hidden />
              Loading
            </p>
          )}
          {friends?.length === 0 && (
            <div className="px-3 pb-3">
              <p className="text-[12px] leading-relaxed text-subtle">
                No friends yet. Open someone&rsquo;s profile at{' '}
                <span className="text-fg">/@their-handle</span> and send a request.
              </p>
            </div>
          )}
          <ul>
            {(friends ?? []).map((f) => (
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
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-surface-2 text-[11px] font-semibold text-muted">
                    {(f.name ?? f.handle).slice(0, 2).toUpperCase()}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[12.5px]">{f.name ?? f.handle}</span>
                    <span className="block truncate text-[11px] text-subtle">@{f.handle}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <div className="flex min-h-0 flex-1 flex-col">
          {active ? (
            <Conversation friend={active} onBack={() => setActive(null)} />
          ) : (
            <div className="hidden flex-1 place-items-center p-6 text-center sm:grid">
              <p className="max-w-xs text-[12.5px] leading-relaxed text-subtle">
                <Users size={18} className="mx-auto mb-2 text-subtle" aria-hidden />
                Pick a friend to see your conversation. You can send them a schedule, a class or an
                outline — they open the live thing, not a screenshot.
              </p>
            </div>
          )}
        </div>
      </div>
    </ModalShell>
  )
}

export function Conversation({ friend, onBack }: { friend: Friend; onBack: () => void }) {
  const { courses } = useAppData()
  const [rows, setRows] = useState<Message[] | null>(null)
  const [body, setBody] = useState('')
  const [pending, setPending] = useState<Attachment | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const [schedules, setSchedules] = useState<SavedSchedule[]>([])
  const [me, setMe] = useState<string | null>(null)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let alive = true
    void (async () => {
      const [msgs, saved] = await Promise.all([listMessages(friend.user_id), listSchedules()])
      if (!alive) return
      setRows(msgs)
      setSchedules(saved)
      void markRead(friend.user_id)
    })()
    return () => {
      alive = false
    }
  }, [friend.user_id, tick])

  // Who sent what is decided by comparing ids, so it needs the viewer's own.
  useEffect(() => {
    let alive = true
    void import('@/lib/supabase').then(({ supabase }) =>
      supabase.auth.getUser().then(({ data }) => alive && setMe(data.user?.id ?? null)),
    )
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [rows])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!body.trim() && !pending) return
    const msg = await sendMessage(friend.user_id, body || ' ', pending ?? undefined)
    if (msg) {
      setError(msg)
      return
    }
    setBody('')
    setPending(null)
    setError(null)
    setTick((n) => n + 1)
  }

  return (
    <>
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2.5">
        <button
          type="button"
          onClick={onBack}
          className="rounded px-1 text-[12px] text-muted transition-colors hover:text-fg sm:hidden"
        >
          ← Friends
        </button>
        <Link
          to={`/@${friend.handle}`}
          className="min-w-0 text-[13px] font-medium text-fg hover:underline"
        >
          {friend.name ?? friend.handle}
        </Link>
        <span className="truncate text-[11.5px] text-subtle">@{friend.handle}</span>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-3">
        {rows === null && <p className="text-[12px] text-subtle">Loading…</p>}
        {rows?.length === 0 && (
          <p className="py-8 text-center text-[12px] text-subtle">
            Nothing here yet. Say something.
          </p>
        )}
        {(rows ?? []).map((m) => {
          const mine = m.sender === me
          return (
            <div key={m.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
              <div
                className={cn(
                  'max-w-[80%] rounded-2xl px-3 py-2',
                  mine
                    ? 'bg-accent text-accent-contrast'
                    : 'border border-border bg-surface-2 text-fg',
                )}
              >
                {m.body.trim() && (
                  <p className="text-[12.5px] leading-relaxed whitespace-pre-wrap">{m.body}</p>
                )}
                {m.attachment && <AttachmentChip attachment={m.attachment} mine={mine} />}
              </div>
            </div>
          )
        })}
        <div ref={endRef} />
      </div>

      <form onSubmit={submit} className="shrink-0 border-t border-border p-2.5">
        {pending && (
          <div className="mb-2 flex items-center gap-2 rounded-lg border border-accent/40 bg-accent-soft px-2.5 py-1.5">
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

        {/* The whole point of this feature, so it sits on the composer rather
            than behind a paperclip nobody opens. */}
        <div className="mb-2 flex flex-wrap gap-1.5">
          {schedules.slice(0, 3).map((s) => (
            <Chip
              key={s.id}
              icon={CalendarRange}
              label={s.name}
              onClick={() => setPending({ kind: 'schedule', id: s.id, name: s.name })}
            />
          ))}
          {courses.slice(0, 4).map((c) => (
            <Chip
              key={c.id}
              icon={BookOpen}
              label={c.code || 'Course'}
              onClick={() => setPending({ kind: 'course', code: c.code, title: c.title })}
            />
          ))}
        </div>

        <div className="flex items-end gap-2">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              // Enter sends, Shift+Enter is a new line — the convention every
              // messaging app has trained people on.
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void submit(e as unknown as React.FormEvent)
              }
            }}
            rows={1}
            placeholder={`Message ${friend.name ?? friend.handle}`}
            className="min-h-[38px] flex-1 resize-none rounded-lg border border-border bg-canvas px-3 py-2 text-[13px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none"
          />
          <button
            type="submit"
            aria-label="Send"
            className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent text-accent-contrast transition-colors duration-150 hover:bg-accent-hover"
          >
            <Send size={15} aria-hidden />
          </button>
        </div>
        {error && <p className="mt-1.5 text-[11.5px] text-warning">{error}</p>}
      </form>
    </>
  )
}

function Chip({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof BookOpen
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex max-w-[9rem] items-center gap-1 rounded-full border border-border px-2 py-1 text-[11px] text-muted transition-colors duration-150 hover:border-accent hover:text-fg"
    >
      <Icon size={11} className="shrink-0" aria-hidden />
      <span className="truncate">{label}</span>
    </button>
  )
}

function describe(a: Attachment): string {
  if (a.kind === 'schedule') return `Schedule · ${a.name}`
  if (a.kind === 'course') return `Class · ${a.code}`
  return `Outline · ${a.code}`
}

/** A link to the live thing, never a copy of it — so a shared schedule shows
 *  what it says today rather than what it said in March. */
function AttachmentChip({ attachment, mine }: { attachment: Attachment; mine: boolean }) {
  const Icon =
    attachment.kind === 'schedule'
      ? CalendarRange
      : attachment.kind === 'course'
        ? BookOpen
        : FileText
  const to =
    attachment.kind === 'schedule'
      ? '/app/planner?tab=schedule'
      : attachment.kind === 'course'
        ? '/app/courses'
        : '/app/courses/blueprints'
  return (
    <Link
      to={to}
      className={cn(
        'mt-1.5 flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11.5px] transition-opacity hover:opacity-80',
        mine ? 'bg-black/15' : 'bg-canvas',
      )}
    >
      <Icon size={12} className="shrink-0" aria-hidden />
      <span className="truncate">{describe(attachment)}</span>
    </Link>
  )
}
