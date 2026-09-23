import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, Link2, Search, X } from 'lucide-react'
import { listFriends, sendMessage, type Attachment, type Friend } from '@/lib/social'
import { PersonAvatar } from './PersonAvatar'
import { matchesQuery } from '@/lib/handles'
import { cn } from '@/lib/cn'

/**
 * Send this to somebody.
 *
 * ONE SHEET FOR EVERYTHING SHAREABLE — a story, a post, an event. It takes a
 * title, a link, and optionally the attachment that makes the message render
 * as a card rather than a URL. Three share sheets would drift in what they
 * call the same action.
 *
 * TWO STEPS, THE WAY THE REFERENCE DOES IT: pick people, and only once one is
 * picked does the composer appear with a Send button. A message box on screen
 * before anyone is selected is a box that cannot do anything.
 *
 * WHO IS LISTED: people you are connected to. A share sheet that offers every
 * account on the service is a directory, and the stranger limits exist
 * precisely so that unsolicited contact is not one tap away.
 */
export function ShareSheet({
  title,
  link,
  attachment,
  onClose,
}: {
  title: string
  link: string
  /** Makes the message arrive as a card. Without it the link still works. */
  attachment?: Attachment
  onClose: () => void
}) {
  const [people, setPeople] = useState<Friend[] | null>(null)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [q, setQ] = useState('')
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    void listFriends().then((rows) => {
      if (alive) setPeople(rows.filter((f) => f.status === 'accepted'))
    })
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => {
      alive = false
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase()
    const all = people ?? []
    if (!term) return all
    return all.filter(
      (p) => matchesQuery(term, p.handle, p.name),
    )
  }, [people, q])

  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const send = async () => {
    if (picked.size === 0 || sending) return
    setSending(true)
    setError(null)
    /*
     * THE CARD IS THE LINK. When an attachment rides along, pasting the URL
     * as well sent a second, uglier copy of the same thing — and a URL has no
     * spaces to wrap at, so the bubble grew wider than the phone and dragged
     * the page sideways. With no attachment the link is all the recipient
     * gets, so there it stays.
     */
    const body = attachment ? note.trim() : [note.trim(), link].filter(Boolean).join('\n')
    const results = await Promise.all([...picked].map((id) => sendMessage(id, body, attachment)))
    setSending(false)
    const failed = results.filter(Boolean)
    // Say how many did not go rather than claiming success for all of them —
    // a recipient's DM setting can refuse one of a batch, and a sheet that
    // closes on "Sent" when it was not is the lie this product avoids.
    if (failed.length > 0) {
      setError(
        failed.length === results.length
          ? (failed[0] as string)
          : `Sent to ${results.length - failed.length}. ${failed.length} could not be delivered.`,
      )
      if (failed.length === results.length) return
    }
    setDone(true)
    window.setTimeout(onClose, 900)
  }

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/60"
      />
      <div className="relative flex max-h-[85vh] w-full flex-col rounded-t-2xl border border-border bg-surface pb-[env(safe-area-inset-bottom)] sm:max-w-md sm:rounded-2xl">
        {/* The grabber: on a phone this is the affordance that says the sheet
            is a sheet, and it costs eight pixels. */}
        <span className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-border-strong sm:hidden" />

        <div className="flex items-center gap-2 px-4 pt-3 pb-2">
          <h2 className="min-w-0 flex-1 truncate text-[14px] font-semibold text-fg">Send {title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid size-7 place-items-center rounded-lg text-subtle hover:text-fg"
          >
            <X size={16} aria-hidden />
          </button>
        </div>

        <div className="px-4 pb-3">
          <div className="relative">
            <Search size={14} className="absolute top-1/2 left-3 -translate-y-1/2 text-subtle" aria-hidden />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search"
              aria-label="Search people"
              className="w-full rounded-full border border-border bg-surface-2 py-2.5 pr-3 pl-9 text-[13px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4">
          {people === null ? (
            <p className="py-8 text-center text-[12.5px] text-subtle">Loading…</p>
          ) : shown.length === 0 ? (
            <p className="py-8 text-center text-[12.5px] text-subtle">
              {q.trim()
                ? 'Nobody by that name.'
                : 'Nobody to send to yet — follow a classmate, and once they follow back you can send them things.'}
            </p>
          ) : (
            <ul className="grid grid-cols-3 gap-x-2 gap-y-4 pb-3 sm:grid-cols-4">
              {shown.map((p) => {
                const on = picked.has(p.user_id)
                return (
                  <li key={p.user_id}>
                    <button
                      type="button"
                      onClick={() => toggle(p.user_id)}
                      aria-pressed={on}
                      className="flex w-full flex-col items-center gap-1.5"
                    >
                      <span className="relative">
                        <PersonAvatar
                          person={{ handle: p.handle, name: p.name, avatar_url: p.avatar_url }}
                          className={cn('size-14 transition-opacity', on && 'opacity-80')}
                        />
                        {on && (
                          <span className="absolute -right-0.5 -bottom-0.5 grid size-5 place-items-center rounded-full border-2 border-surface bg-accent text-accent-contrast">
                            <Check size={11} strokeWidth={3} aria-hidden />
                          </span>
                        )}
                      </span>
                      <span className="w-full truncate text-center text-[11.5px] text-muted">
                        {p.name ?? p.handle}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* Only once somebody is picked. Before that there is nothing to send
            and the box would just be furniture. */}
        {picked.size > 0 && (
          <div className="border-t border-border px-4 pt-3 pb-3">
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Write a message…"
              aria-label="Message"
              className="w-full bg-transparent py-1.5 text-[13.5px] text-fg placeholder:text-subtle focus:outline-none"
            />
            {error && <p className="mb-2 text-[11.5px] text-warning">{error}</p>}
            <button
              type="button"
              disabled={sending || done}
              onClick={() => void send()}
              className="mt-1 w-full rounded-xl bg-accent py-2.5 text-[14px] font-semibold text-accent-contrast transition-colors duration-150 hover:bg-accent-hover disabled:opacity-60"
            >
              {done ? 'Sent' : sending ? 'Sending…' : `Send${picked.size > 1 ? ` (${picked.size})` : ''}`}
            </button>
          </div>
        )}

        {/* Always available, and the only route that works for somebody who is
            not on here yet. */}
        <div className="border-t border-border px-4 py-3">
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(link).then(
                () => setCopied(true),
                () => setCopied(false),
              )
            }}
            className="flex w-full items-center gap-2.5 rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-[13px] text-fg transition-colors duration-150 hover:border-accent"
          >
            <Link2 size={15} className="shrink-0 text-subtle" aria-hidden />
            {copied ? 'Link copied' : 'Copy link'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
