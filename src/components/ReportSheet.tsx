import { useState } from 'react'
import { Flag, Loader2 } from 'lucide-react'
import { ModalShell } from '@/command/ModalShell'
import { submitTicket } from '@/lib/tickets'
import { cn } from '@/lib/cn'

/**
 * Reporting anything a person can see on here: a post, a message, an account.
 *
 * ONE SHEET FOR ALL THREE, because they are one job — pick what is wrong, say
 * anything else, send — and three dialogs had drifted (the post one had reasons,
 * the message one had none, profiles had no report at all). App Store review
 * guideline 1.2 asks for exactly this on user-generated content.
 *
 * IT FILES A REAL SUPPORT TICKET rather than feeding a queue nobody reads: the
 * admin console already works that inbox, and the reporter can follow it in
 * Messages → Support. It says so up front, including that it is not anonymous
 * to us and that the other person is not told.
 */
export type ReportTarget = 'post' | 'message' | 'account'

const REASONS = [
  'Spam or scam',
  'Harassment or bullying',
  'Hate speech or symbols',
  'Violence or threats',
  'Nudity or sexual content',
  'Impersonation',
  'False information',
  'Something else',
] as const

const NOUN: Record<ReportTarget, string> = {
  post: 'post',
  message: 'message',
  account: 'account',
}

export function ReportSheet({
  target,
  subject,
  details,
  preview,
  onClose,
  onSent,
}: {
  target: ReportTarget
  /** The ticket subject, e.g. "Reported post by @club". */
  subject: string
  /** Context lines for the admin: ids, handles, the reported text. */
  details: string[]
  /** What is being reported, quoted back so the reporter can check it. */
  preview?: string
  onClose: () => void
  onSent?: (caseId: string) => void
}) {
  const [reason, setReason] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState<string | null>(null)

  const send = async () => {
    if (!reason || busy) return
    setBusy(true)
    setError('')
    try {
      const { caseId } = await submitTicket({
        subject,
        category: 'other',
        message: [
          `Reason: ${reason}`,
          note.trim() ? `Reporter's note: ${note.trim()}` : null,
          '',
          ...details,
        ]
          .filter((l): l is string => l !== null)
          .join('\n'),
      })
      setSent(caseId || 'received')
      onSent?.(caseId)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send that report. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <ModalShell label={`Report ${NOUN[target]}`} onClose={onClose} widthClass="sm:max-w-sm">
      <div className="px-4 pt-3 pb-4">
        {sent ? (
          <div className="py-4 text-center">
            <p className="text-[15px] font-semibold text-fg">Thanks, we have it</p>
            <p className="mx-auto mt-1 max-w-xs text-[13px] leading-relaxed text-subtle">
              We review reports within 24 hours.
              {sent !== 'received' && ` It is ${sent} in your Messages, under Support, if you want to add anything.`}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-4 rounded-lg bg-accent px-4 py-2 text-[13px] font-semibold text-accent-contrast"
            >
              Done
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2.5 pr-9">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-danger/15 text-danger">
                <Flag size={15} aria-hidden />
              </span>
              <h2 className="text-[15px] font-semibold text-fg">Report this {NOUN[target]}</h2>
            </div>
            {preview && (
              <p className="mt-3 line-clamp-3 rounded-xl bg-surface-2 px-3 py-2 text-[12.5px] break-words text-muted">
                {preview}
              </p>
            )}
            <p className="mt-2.5 text-[12px] leading-relaxed text-subtle">
              What&rsquo;s wrong with it? It opens a support conversation you can follow. Not anonymous to
              us, and they won&rsquo;t be told you reported it.
            </p>
            <div role="radiogroup" aria-label="Reason" className="mt-2 flex flex-col">
              {REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  role="radio"
                  aria-checked={reason === r}
                  onClick={() => setReason(r)}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-[13.5px] transition-colors duration-150',
                    reason === r ? 'bg-surface-2 text-fg' : 'text-muted hover:bg-surface-2/60 hover:text-fg',
                  )}
                >
                  <span
                    className={cn(
                      'grid size-4 shrink-0 place-items-center rounded-full border',
                      reason === r ? 'border-accent' : 'border-border-strong',
                    )}
                    aria-hidden
                  >
                    {reason === r && <span className="size-2 rounded-full bg-accent" />}
                  </span>
                  {r}
                </button>
              ))}
            </div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 500))}
              rows={2}
              placeholder="Anything else we should know? (optional)"
              className="mt-2 w-full resize-none rounded-lg border border-border bg-canvas px-3 py-2 text-[13px] text-fg outline-none placeholder:text-subtle focus:border-border-strong"
            />
            {error && <p className="mt-1.5 text-[12px] text-danger">{error}</p>}
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg px-3.5 py-2 text-[13px] font-medium text-muted hover:text-fg"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!reason || busy}
                onClick={() => void send()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-danger px-3.5 py-2 text-[13px] font-semibold text-white disabled:opacity-50"
              >
                {busy && <Loader2 size={14} className="animate-spin" aria-hidden />}
                Send report
              </button>
            </div>
          </>
        )}
      </div>
    </ModalShell>
  )
}
