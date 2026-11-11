import { useState } from 'react'
import { AlertTriangle, CheckCircle2, Inbox, LifeBuoy, RotateCw, Sparkles, UploadCloud } from 'lucide-react'
import { requestParseReview, sendSyllabusToSupport } from '@/lib/parse-syllabus'
import { useSupport } from '@/app/providers/support'
import { useT } from '@/i18n/i18n'

/**
 * What a student sees when a syllabus could not be read.
 *
 * The reason first, in plain words (the server only ever sends safe text),
 * then the two real choices: try again (the same file or another), or leave
 * it. Leaving it is a genuine handoff: the failed upload is already in the
 * admin review queue with its file (db/parse_review.sql), this marks the
 * student as waiting, and an admin adds it to their courses and notifies
 * them. "Leave it" only appears when the file was kept, because promising a
 * review of a file we do not have would be a lie.
 */
export function SyllabusFailure({
  message,
  eventId,
  reviewable,
  canRetrySame,
  onRetrySame,
  onTryBackup,
  file,
  onChooseAnother,
  onDone,
}: {
  /** Re-run the same file on the fallback AI. */
  onTryBackup?: () => void
  /** The file that failed, so it can be sent to support. */
  file?: File | null
  message: string
  eventId: string | null
  reviewable: boolean
  canRetrySame: boolean
  onRetrySame: () => void
  onChooseAnother: () => void
  onDone: () => void
}) {
  const t = useT()
  const [state, setState] = useState<'idle' | 'sending' | 'left' | 'error'>('idle')
  const [ticket, setTicket] = useState<{ state: 'idle' | 'sending' | 'sent' | 'error'; caseId?: string; error?: string }>({
    state: 'idle',
  })
  const { openSupport } = useSupport()

  async function sendToSupport() {
    if (!file) {
      openSupport()
      return
    }
    setTicket({ state: 'sending' })
    try {
      const caseId = await sendSyllabusToSupport(file, message)
      setTicket({ state: 'sent', caseId })
    } catch (e) {
      setTicket({ state: 'error', error: e instanceof Error ? e.message : 'That did not send.' })
    }
  }

  async function leave() {
    if (!eventId) return
    setState('sending')
    try {
      setState((await requestParseReview(eventId)) ? 'left' : 'error')
    } catch {
      setState('error')
    }
  }

  if (state === 'left') {
    return (
      <div className="mt-6 rounded-2xl border border-success/40 bg-success/5 p-6 text-center" role="status">
        <CheckCircle2 size={24} className="mx-auto text-success" aria-hidden />
        <p className="mt-2 text-[15px] font-semibold text-fg">{t('parseFail.leftTitle')}</p>
        <p className="mx-auto mt-1.5 max-w-md text-[13.5px] leading-relaxed text-muted">{t('parseFail.leftBody')}</p>
        <button
          type="button"
          onClick={onDone}
          className="mt-4 rounded-lg bg-accent px-3.5 py-2 text-[13px] font-medium text-accent-contrast hover:opacity-90"
        >
          {t('parseFail.backToCourses')}
        </button>
      </div>
    )
  }

  return (
    <div className="mt-6 rounded-2xl border border-danger/40 bg-danger/5 p-6 text-center">
      <AlertTriangle size={24} className="mx-auto text-danger" aria-hidden />
      <p className="mt-2 text-[14px] font-medium text-fg" role="alert">{message}</p>

      <div className="mx-auto mt-4 grid max-w-md gap-2 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface p-3 text-left">
          <p className="text-[13px] font-semibold text-fg">{t('parseFail.tryTitle')}</p>
          <p className="mt-0.5 text-[12px] text-subtle">{t('parseFail.tryBody')}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {canRetrySame && (
              <button type="button" onClick={onRetrySame} className="inline-flex items-center gap-1 rounded-lg bg-accent px-2.5 py-1.5 text-[12px] font-medium text-accent-contrast hover:opacity-90">
                <RotateCw size={13} aria-hidden /> {t('parseFail.retrySame')}
              </button>
            )}
            <button type="button" onClick={onChooseAnother} className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-[12px] font-medium text-muted hover:bg-surface-2 hover:text-fg">
              <UploadCloud size={13} aria-hidden /> {t('parseFail.another')}
            </button>
            {canRetrySame && onTryBackup && (
              <button
                type="button"
                onClick={onTryBackup}
                title="Reads it again with our second AI, which sometimes manages files the first one cannot."
                className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-[12px] font-medium text-muted hover:bg-surface-2 hover:text-fg"
              >
                <Sparkles size={13} aria-hidden /> Try the other AI
              </button>
            )}
          </div>
        </div>

        {reviewable && eventId ? (
          <div className="rounded-xl border border-border bg-surface p-3 text-left">
            <p className="text-[13px] font-semibold text-fg">{t('parseFail.leaveTitle')}</p>
            <p className="mt-0.5 text-[12px] text-subtle">{t('parseFail.leaveBody')}</p>
            <button
              type="button"
              disabled={state === 'sending'}
              onClick={() => void leave()}
              className="mt-2 inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-[12px] font-medium text-muted hover:bg-surface-2 hover:text-fg disabled:opacity-60"
            >
              <Inbox size={13} aria-hidden /> {state === 'sending' ? t('parseFail.leaving') : t('parseFail.leave')}
            </button>
            {state === 'error' && <p className="mt-1.5 text-[11.5px] text-danger">{t('parseFail.leaveError')}</p>}
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-surface p-3 text-left">
            <p className="text-[13px] font-semibold text-fg">{t('parseFail.stuckTitle')}</p>
            {ticket.state === 'sent' ? (
              <>
                <p className="mt-0.5 text-[12px] text-subtle">
                  Sent to support{ticket.caseId ? ` as ${ticket.caseId}` : ''}. We will add it to your courses and let
                  you know by email and in Messages.
                </p>
                <button
                  type="button"
                  onClick={openSupport}
                  className="mt-2 inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-[12px] font-medium text-muted hover:bg-surface-2 hover:text-fg"
                >
                  <LifeBuoy size={13} aria-hidden /> Open the conversation
                </button>
              </>
            ) : (
              <>
                <p className="mt-0.5 text-[12px] text-subtle">
                  {file
                    ? 'Send the file to us and a person will add it to your courses for you.'
                    : 'Write to us and a person will add it for you.'}
                </p>
                <button
                  type="button"
                  disabled={ticket.state === 'sending'}
                  onClick={() => void sendToSupport()}
                  className="mt-2 inline-flex items-center gap-1 rounded-lg bg-accent px-2.5 py-1.5 text-[12px] font-medium text-accent-contrast hover:opacity-90 disabled:opacity-60"
                >
                  <LifeBuoy size={13} aria-hidden />
                  {ticket.state === 'sending' ? 'Sending' : file ? 'Send it to support' : 'Contact support'}
                </button>
                {ticket.state === 'error' && <p className="mt-1.5 text-[11.5px] text-danger">{ticket.error}</p>}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
