import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { ModalShell } from '@/command/ModalShell'
import { sendMessageToOrg } from '@/lib/org-messages'
import { OrgFace, type OrgChatTarget } from '@/features/profile/OrgChat'

/**
 * Write to a club from its profile.
 *
 * A DIALOG, NOT A JUMP TO MESSAGES. You are looking at the club when you
 * decide to write to it; being thrown into a conversation list to find it
 * again is the shape the "Edit profile" link got wrong. Once sent, the thread
 * is in Messages like any other — the dialog says so rather than leaving you
 * wondering where the reply will arrive.
 */
export function MessageOrgModal({
  org,
  onClose,
}: {
  /** `id` is null while the handle is still being resolved — Send says so
   *  rather than failing silently. */
  org: Omit<OrgChatTarget, 'id'> & { id: string | null }
  onClose: () => void
}) {
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const send = async () => {
    if (!org.id) return setError('Could not find that club.')
    if (sending) return
    setSending(true)
    const err = await sendMessageToOrg(org.id, body)
    setSending(false)
    if (err) return setError(err)
    setSent(true)
  }

  return (
    <ModalShell label={`Message ${org.name}`} onClose={onClose} widthClass="sm:max-w-md">
      <div className="p-4 sm:p-5">
        <div className="flex items-center gap-3">
          <OrgFace org={{ ...org, id: org.id ?? '' }} className="size-10" />
          <div className="min-w-0">
            <h2 className="truncate text-[15px] font-medium text-fg">{org.name}</h2>
            <p className="truncate text-[12px] text-subtle">{org.handle}</p>
          </div>
        </div>

        {sent ? (
          <p className="mt-4 rounded-xl border border-border bg-surface-2/50 px-3.5 py-3 text-[13px] leading-relaxed text-fg">
            Sent. Whoever runs {org.name} will see it, and their reply lands in your Messages.
          </p>
        ) : (
          <>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              maxLength={2000}
              autoFocus
              placeholder={`Ask ${org.name} something…`}
              className="mt-4 w-full resize-none rounded-xl border border-border bg-canvas px-3 py-2.5 text-[13.5px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none"
            />
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-subtle">
              This goes to the club, not to one person. Anyone on their team can answer.
            </p>
            {error && <p className="mt-2 text-[12px] text-warning">{error}</p>}
          </>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-3 py-2 text-[13px] text-muted transition-colors duration-150 hover:text-fg"
          >
            {sent ? 'Done' : 'Cancel'}
          </button>
          {!sent && (
            <button
              type="button"
              onClick={() => void send()}
              disabled={!body.trim() || sending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-[13px] font-medium text-accent-contrast transition-colors duration-150 hover:bg-accent-hover disabled:opacity-60"
            >
              {sending && <Loader2 size={13} className="animate-spin" aria-hidden />}
              Send
            </button>
          )}
        </div>
      </div>
    </ModalShell>
  )
}
