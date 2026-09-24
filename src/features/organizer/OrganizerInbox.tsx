import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Inbox, Loader2, PenSquare, Search, SendHorizonal } from 'lucide-react'
import { useTeacher } from '@/app/providers/teacher'
import { PersonAvatar } from '@/features/community/PersonAvatar'
import { Mascot } from '@/components/Mascot'
import { shortAgo } from '@/lib/social'
import {
  markOrgThreadRead,
  orgThreadMessages,
  orgThreads,
  replyAsOrg,
  type OrgMessage,
  type OrgThread,
} from '@/lib/org-messages'
import { NewOrgMessage } from './NewOrgMessage'
import { cn } from '@/lib/cn'

/** Module level: `react-hooks/purity` bars a clock read in a component body. */
const ago = (iso: string) => shortAgo(iso, Date.now())

/**
 * The club's inbox.
 *
 * IT LIVES IN THE PORTAL, NOT IN THE MEMBER'S OWN DMs. A message to the club
 * is the club's, not the individual's: whoever is on the team this year can
 * answer it, and it does not leave when they graduate. That is the whole
 * reason `messages` learned to address an organisation.
 *
 * THE TEAM SEES WHO ANSWERED; THE STUDENT SEES THE CLUB. A shared mailbox
 * where nobody can tell which volunteer replied is how an organisation ends
 * up unable to resolve a complaint — but which volunteer it was is the club's
 * business, not something the student needs in order to read a reply.
 *
 * IT CAN NOW WRITE FIRST — TO ITS OWN FOLLOWERS, AND ONLY ONCE. An account
 * students are told to trust, able to cold-message anybody, is the thing this
 * model exists to avoid; so a club may open a conversation only with somebody
 * who follows it and has left club messages on, and only one message until
 * they answer. All three rules live in `send_org_dm`, not here — a picker that
 * shows the right people is a convenience, not a control.
 */
export function OrganizerInbox() {
  const { currentOrg } = useTeacher()
  const orgId = currentOrg?.id ?? ''
  const [threads, setThreads] = useState<OrgThread[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [active, setActive] = useState<OrgThread | null>(null)
  const [tick, setTick] = useState(0)
  const [q, setQ] = useState('')
  const [composing, setComposing] = useState(false)
  const refresh = useCallback(() => setTick((n) => n + 1), [])

  useEffect(() => {
    if (!orgId) return
    let alive = true
    void orgThreads(orgId)
      .then((r) => alive && setThreads(r))
      .catch(() => alive && setFailed(true))
    return () => {
      alive = false
    }
  }, [orgId, tick])

  if (!currentOrg) return null

  const needle = q.trim().toLowerCase()
  const shown = (threads ?? []).filter(
    (t) =>
      !needle ||
      (t.name ?? '').toLowerCase().includes(needle) ||
      (t.handle ?? '').toLowerCase().includes(needle) ||
      (t.lastBody ?? '').toLowerCase().includes(needle),
  )

  const open = (t: OrgThread) => {
    setActive(t)
    void markOrgThreadRead(orgId, t.other).then(refresh)
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-6 sm:px-6">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-[22px] font-semibold text-fg">Inbox</h1>
          <p className="mt-0.5 text-[13px] text-subtle">
            Messages students have sent {currentOrg.org.name}, including replies to your stories.
            Anyone on the team can answer, and the reply goes out as the club.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setComposing(true)
            setActive(null)
          }}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-[13px] font-medium text-accent-contrast transition-colors duration-150 hover:bg-accent-hover"
        >
          <PenSquare size={15} aria-hidden />
          New message
        </button>
      </header>

      <div className="overflow-hidden rounded-2xl border border-border bg-surface lg:flex lg:h-[min(70vh,640px)]">
        <aside
          className={cn(
            'border-border lg:w-72 lg:shrink-0 lg:overflow-y-auto lg:border-r',
            active && 'hidden lg:block',
          )}
        >
          {/* Scoped to the list it filters, which is the same rule the
              student inbox follows: a control lives in the section it acts
              on. Client-side, because a club's inbox is tens of rows, not
              thousands, and a round trip per keystroke buys nothing. */}
          <div className="border-b border-border p-2.5">
            <label className="flex items-center gap-2 rounded-full border border-border bg-surface-2 px-3 py-1.5">
              <Search size={13} className="shrink-0 text-subtle" aria-hidden />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search messages"
                aria-label="Search messages"
                className="w-full min-w-0 bg-transparent text-[13px] text-fg placeholder:text-subtle focus:outline-none"
              />
            </label>
          </div>

          {failed ? (
            <div className="p-6 text-center">
              <p className="text-[13px] text-subtle">Could not load the inbox.</p>
              <button
                type="button"
                onClick={refresh}
                className="mt-2 rounded-lg border border-border px-3 py-1.5 text-[12.5px] text-fg transition-colors duration-150 hover:border-accent"
              >
                Try again
              </button>
            </div>
          ) : threads === null ? (
            <p className="p-6 text-center text-[13px] text-subtle">Loading…</p>
          ) : threads.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-5 py-12 text-center">
              <Mascot mood="resting" size="sm" soft className="text-accent" />
              <p className="text-[13.5px] font-medium text-fg">No messages yet</p>
              <p className="max-w-xs text-[12.5px] leading-relaxed text-subtle">
                When somebody replies to one of your stories, or writes to the club from its
                profile, it lands here.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border lg:divide-y-0">
              {shown.length === 0 && (
                <li className="px-4 py-8 text-center text-[13px] text-subtle">
                  Nothing matches “{q}”.
                </li>
              )}
              {shown.map((t) => (
                <li key={t.other}>
                  <button
                    type="button"
                    onClick={() => open(t)}
                    className={cn(
                      'flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors duration-150',
                      active?.other === t.other ? 'lg:bg-accent-soft' : 'hover:bg-surface-2/60',
                    )}
                  >
                    <PersonAvatar
                      person={{ handle: t.handle ?? '', name: t.name, avatar_url: t.avatar }}
                      className="size-10"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-2">
                        <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-fg">
                          {t.name ?? t.handle}
                        </span>
                        {t.lastAt && (
                          <span className="shrink-0 text-[11px] text-subtle">{ago(t.lastAt)}</span>
                        )}
                      </span>
                      <span className="flex items-center gap-2">
                        <span
                          className={cn(
                            'min-w-0 flex-1 truncate text-[12.5px]',
                            t.unread > 0 ? 'font-medium text-fg' : 'text-subtle',
                          )}
                        >
                          {t.lastFromOrg ? 'You: ' : ''}
                          {t.lastBody}
                        </span>
                        {t.unread > 0 && (
                          <span className="size-2 shrink-0 rounded-full bg-accent" aria-hidden />
                        )}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        {composing ? (
          <div className="flex-1">
            <NewOrgMessage
              orgId={orgId}
              onCancel={() => setComposing(false)}
              onSent={(userId) => {
                setComposing(false)
                refresh()
                // Drop straight into the thread that now exists, rather than
                // leaving somebody wondering whether it sent.
                setActive({
                  other: userId,
                  name: null,
                  handle: null,
                  avatar: null,
                  lastBody: '',
                  lastAt: null,
                  lastFromOrg: true,
                  unread: 0,
                } as OrgThread)
              }}
            />
          </div>
        ) : active ? (
          <Conversation
            orgId={orgId}
            thread={active}
            onBack={() => setActive(null)}
            onSent={refresh}
          />
        ) : (
          <div className="hidden flex-1 flex-col items-center justify-center gap-2 text-center lg:flex">
            <Inbox size={22} className="text-subtle" aria-hidden />
            <p className="text-[13px] text-subtle">Pick a conversation.</p>
          </div>
        )}
      </div>
    </div>
  )
}

function Conversation({
  orgId,
  thread,
  onBack,
  onSent,
}: {
  orgId: string
  thread: OrgThread
  onBack: () => void
  onSent: () => void
}) {
  const [rows, setRows] = useState<OrgMessage[] | null>(null)
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const end = useRef<HTMLDivElement | null>(null)

  // Reset during render when the thread changes — an effect that setStates on
  // mount renders twice and trips react-hooks/set-state-in-effect.
  const [shownFor, setShownFor] = useState(thread.other)
  if (shownFor !== thread.other) {
    setShownFor(thread.other)
    setRows(null)
    setError(null)
  }

  useEffect(() => {
    let alive = true
    void orgThreadMessages(orgId, thread.other)
      .then((r) => alive && setRows(r))
      .catch(() => alive && setRows([]))
    return () => {
      alive = false
    }
  }, [orgId, thread.other, tick])

  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' })
  }, [rows])

  const send = async () => {
    const text = body.trim()
    if (!text || sending) return
    setSending(true)
    const err = await replyAsOrg(orgId, thread.other, text)
    setSending(false)
    if (err) {
      setError(err)
      return
    }
    setBody('')
    setError(null)
    setTick((n) => n + 1)
    onSent()
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center gap-2.5 border-b border-border px-3 py-2.5">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to the inbox"
          className="grid size-8 shrink-0 place-items-center rounded-lg text-muted transition-colors duration-150 hover:text-fg lg:hidden"
        >
          <ArrowLeft size={17} aria-hidden />
        </button>
        <PersonAvatar
          person={{ handle: thread.handle ?? '', name: thread.name, avatar_url: thread.avatar }}
          className="size-9"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-medium text-fg">{thread.name ?? thread.handle}</p>
          {thread.handle && (
            <Link
              to={`/@${thread.handle}`}
              className="block truncate text-[12px] text-subtle hover:text-fg"
            >
              @{thread.handle}
            </Link>
          )}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {rows === null ? (
          <p className="py-10 text-center text-[13px] text-subtle">Loading…</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {rows.map((m) => (
              <li
                key={m.id}
                className={cn('flex flex-col', m.fromOrg ? 'items-end' : 'items-start')}
              >
                <span
                  className={cn(
                    'max-w-[78%] rounded-2xl px-3 py-2 text-[13.5px] leading-relaxed whitespace-pre-wrap',
                    m.fromOrg
                      ? 'rounded-br-md bg-accent text-accent-contrast'
                      : 'rounded-bl-md bg-surface-2 text-fg',
                  )}
                >
                  {m.body}
                </span>
                {/* WHO ON THE TEAM ANSWERED. The student never sees this — the
                    reply reaches them as the club — but a shared mailbox where
                    the team cannot tell who replied is one nobody can run. */}
                <span className="mt-0.5 px-1 text-[10.5px] text-subtle">
                  {m.fromOrg && m.senderName ? `${m.senderName} · ` : ''}
                  {ago(m.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
        <div ref={end} />
      </div>

      <div className="border-t border-border p-2.5">
        {error && <p className="mb-1.5 px-1 text-[11.5px] text-warning">{error}</p>}
        <div className="flex items-end gap-2">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void send()
              }
            }}
            rows={1}
            maxLength={2000}
            placeholder="Reply as the club…"
            className="max-h-32 min-h-[40px] flex-1 resize-none rounded-xl border border-border bg-canvas px-3 py-2.5 text-[13.5px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none"
          />
          <button
            type="button"
            onClick={() => void send()}
            disabled={!body.trim() || sending}
            aria-label="Send"
            className="grid size-10 shrink-0 place-items-center rounded-full bg-accent text-accent-contrast transition-colors duration-150 hover:bg-accent-hover disabled:opacity-50"
          >
            {sending ? (
              <Loader2 size={16} className="animate-spin" aria-hidden />
            ) : (
              <SendHorizonal size={16} aria-hidden />
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
