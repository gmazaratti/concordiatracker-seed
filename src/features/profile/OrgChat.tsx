import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, Loader2, SendHorizonal } from 'lucide-react'
import { VerifiedBadge } from '@/features/community/VerifiedBadge'
import { myThreadWithOrg, sendMessageToOrg, type OrgDm } from '@/lib/org-messages'
import { shortAgo } from '@/lib/social'
import { cn } from '@/lib/cn'
import { FallbackImg } from '@/components/ui/FallbackImg'

/** Module level so reading the clock is allowed — `react-hooks/purity` bars it
 *  inside a component body. */
const ago = (iso: string) => shortAgo(iso, Date.now())

export interface OrgChatTarget {
  id: string
  handle: string
  name: string
  avatar: string | null
  color: string | null
  glyph: string | null
  verified: boolean
}

/**
 * The student's side of a conversation with a club.
 *
 * A SEPARATE COMPONENT FROM `Chat`, and deliberately simpler. `Chat` carries
 * attachments, the schedule rail, the person menu and the follow graph — none
 * of which mean anything opposite an organisation. Forcing a club through it
 * would have meant a nullable branch on every one of those.
 *
 * YOU ARE TALKING TO THE CLUB, NOT TO A PERSON. Replies arrive under the
 * club's name and logo even though a specific member typed them: the club is
 * the account, and which volunteer answered is the club's business, not a fact
 * a student needs in order to read a reply. Their own team sees the name in
 * the portal.
 */
export function OrgChat({ org, onBack }: { org: OrgChatTarget; onBack: () => void }) {
  const [rows, setRows] = useState<OrgDm[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const end = useRef<HTMLDivElement | null>(null)

  const reload = useCallback(() => setTick((n) => n + 1), [])

  /* Reset DURING RENDER when the club changes, tracked in state — an effect
   * that setStates on mount renders twice and trips
   * react-hooks/set-state-in-effect, the same shape ScheduleAccess uses. */
  const [shownFor, setShownFor] = useState(org.id)
  if (shownFor !== org.id) {
    setShownFor(org.id)
    setRows(null)
    setFailed(false)
    setError(null)
  }

  useEffect(() => {
    let alive = true
    void myThreadWithOrg(org.id)
      .then((r) => alive && setRows(r))
      .catch(() => alive && setFailed(true))
    return () => {
      alive = false
    }
  }, [org.id, tick])

  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' })
  }, [rows])

  const send = async () => {
    const text = body.trim()
    if (!text || sending) return
    setSending(true)
    const err = await sendMessageToOrg(org.id, text)
    setSending(false)
    if (err) {
      setError(err)
      return
    }
    setBody('')
    setError(null)
    reload()
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex shrink-0 items-center gap-2.5 border-b border-border px-3 py-2.5">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to conversations"
          className="-ml-1 grid size-8 shrink-0 place-items-center rounded-full text-fg transition-colors duration-150 hover:bg-surface-2 lg:hidden"
        >
          <ChevronLeft size={22} aria-hidden />
        </button>
        <OrgFace org={org} className="size-9" />
        <Link
          to={`/app/community/org/${org.handle.replace(/^@/, '')}`}
          className="min-w-0 flex-1"
        >
          <span className="flex items-center gap-1.5">
            <span className="truncate text-[14px] font-medium text-fg">{org.name}</span>
            {org.verified && <VerifiedBadge size={13} />}
          </span>
          <span className="block truncate text-[12px] text-subtle">
            {org.handle} · Organization
          </span>
        </Link>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {failed ? (
          <div className="py-10 text-center">
            <p className="text-[13px] text-subtle">Could not load this conversation.</p>
            <button
              type="button"
              onClick={reload}
              className="mt-2 rounded-lg border border-border px-3 py-1.5 text-[12.5px] text-fg transition-colors duration-150 hover:border-accent"
            >
              Try again
            </button>
          </div>
        ) : rows === null ? (
          <p className="py-10 text-center text-[13px] text-subtle">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="py-10 text-center text-[12.5px] leading-relaxed text-subtle">
            Nothing here yet. Whatever you send reaches the people who run {org.name}.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {rows.map((m) => (
              <li
                key={m.id}
                className={cn('flex items-end gap-2', !m.fromOrg && 'flex-row-reverse')}
              >
                {m.fromOrg && <OrgFace org={org} className="size-6 shrink-0" />}
                <span
                  className={cn(
                    'max-w-[78%] rounded-[22px] px-3.5 py-2.5 text-[15px] leading-[1.35] break-words whitespace-pre-wrap lg:text-[14px]',
                    m.fromOrg
                      ? 'rounded-bl-md bg-surface-2 text-fg'
                      : 'rounded-br-md bg-accent text-accent-contrast',
                  )}
                >
                  {m.body}
                  <span
                    className={cn(
                      'mt-0.5 block text-[10.5px]',
                      m.fromOrg ? 'text-subtle' : 'text-accent-contrast/70',
                    )}
                  >
                    {ago(m.createdAt)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
        <div ref={end} />
      </div>

      <div className="shrink-0 border-t border-border p-2.5">
        {error && <p className="mb-1.5 px-1 text-[11.5px] text-warning">{error}</p>}
        <div className="flex items-end gap-2">
          <div className="flex min-w-0 flex-1 items-end gap-1 rounded-[20px] border border-border bg-canvas py-1 pr-1 pl-3.5 transition-colors duration-150 focus-within:border-accent">
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
              placeholder={`Message ${org.name}…`}
              className="max-h-28 min-h-[30px] flex-1 resize-none self-center bg-transparent py-1 text-[15px] text-fg placeholder:text-subtle focus:outline-none lg:text-[14px]"
            />
            {/* Grows in with the first character — see Chat.tsx. */}
            <button
              type="button"
              onClick={() => void send()}
              disabled={!body.trim() || sending}
              tabIndex={body.trim() ? 0 : -1}
              aria-label="Send"
              className={cn(
                'grid h-8 shrink-0 place-items-center overflow-hidden rounded-full bg-accent text-accent-contrast',
                'transition-[width,opacity,transform] duration-200 ease-out hover:bg-accent-hover',
                body.trim()
                  ? 'w-8 scale-100 opacity-100'
                  : 'pointer-events-none w-0 scale-75 opacity-0',
              )}
            >
              {sending ? (
                <Loader2 size={15} className="animate-spin" aria-hidden />
              ) : (
                <SendHorizonal size={15} className="translate-x-px" aria-hidden />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/** The logo, or the brand-coloured initials — the same fallback every other
 *  org surface uses, so a dead URL is never an empty box. */
export function OrgFace({ org, className }: { org: OrgChatTarget; className?: string }) {
  return (
    <span
      className={cn(
        'relative grid shrink-0 place-items-center overflow-hidden rounded-full text-[11px] font-semibold text-white',
        className,
      )}
      style={{ background: org.color ?? '#4b5563' }}
    >
      {(org.glyph || org.name.slice(0, 2)).toUpperCase()}
      <FallbackImg src={org.avatar} className="absolute inset-0 size-full object-cover" />
    </span>
  )
}
