import { useState } from 'react'
import { Check, Copy, MessageSquare, Share2 } from 'lucide-react'
import type { CampusEvent } from '@/data/community'
import { ModalShell } from '@/command/ModalShell'
import { ShareSheet } from './ShareSheet'

/** "Share this event" popup — a direct, public link + a copy button. The link
 * (`/e/:id`) is viewable by anyone, no account needed (see `PublicEventPage`). */
export function ShareEventModal({ event, onClose }: { event: CampusEvent; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  const [sending, setSending] = useState(false)
  const url = `${window.location.origin}/e/${event.id}`

  function copy() {
    navigator.clipboard?.writeText(url).then(
      () => setCopied(true),
      () => setCopied(false),
    )
  }

  return (
    <ModalShell label="Share event" onClose={onClose}>
      <div className="p-5">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
            <Share2 size={18} aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold text-fg">Share this event</h2>
            <p className="truncate text-[12px] text-subtle">{event.title}</p>
          </div>
        </div>

        <p className="mt-3 text-[12px] text-muted">
          Anyone with this link can view the event: no account needed.
        </p>

        <div className="mt-2 flex items-center gap-2">
          <input
            readOnly
            value={url}
            aria-label="Event link"
            onFocus={(e) => e.currentTarget.select()}
            className="min-w-0 flex-1 rounded-lg border border-border bg-surface-2 px-3 py-2 text-[13px] text-fg focus:border-accent focus:outline-none"
          />
          <button
            type="button"
            onClick={copy}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-[13px] font-medium text-accent-contrast transition-colors duration-150 hover:bg-accent-hover"
          >
            {copied ? <Check size={15} aria-hidden /> : <Copy size={15} aria-hidden />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>

        {/*
          THE WHOLE SEND HAPPENS HERE. This used to navigate to Messages with
          `?attach=event:id` and leave you to find a conversation — two screens
          and a search for one action, and if you never picked a thread the
          attachment quietly evaporated. The share sheet already knows how to
          pick people and send, so it does both, with the event riding as a
          real card rather than a pasted URL.
        */}
        <button
          type="button"
          onClick={() => setSending(true)}
          className="mt-3 flex w-full items-center gap-2 rounded-lg border border-border px-3 py-2.5 text-left transition-colors duration-150 hover:border-accent"
        >
          <MessageSquare size={15} className="shrink-0 text-accent" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-medium text-fg">Send to a friend</span>
            <span className="block text-[11.5px] text-subtle">
              Arrives as the live event, not a screenshot.
            </span>
          </span>
        </button>

        {sending && (
          <ShareSheet
            title={event.title}
            link={url}
            attachment={{ kind: 'event', id: event.id, title: event.title }}
            onClose={() => {
              setSending(false)
              onClose()
            }}
          />
        )}

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-3.5 py-2 text-[13px] font-medium text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
          >
            Done
          </button>
        </div>
      </div>
    </ModalShell>
  )
}
