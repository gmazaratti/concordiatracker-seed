import { useState } from 'react'
import { CHURN_REASONS, submitChurn, type ChurnKind, type ChurnReason } from '@/lib/churn'
import { cn } from '@/lib/cn'

/** The reasons as chips plus an optional note. Controlled, so a parent can submit it. */
export function ChurnReasonPicker({
  reason,
  detail,
  onReason,
  onDetail,
}: {
  reason: ChurnReason | null
  detail: string
  onReason: (r: ChurnReason | null) => void
  onDetail: (d: string) => void
}) {
  return (
    <div>
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Reason">
        {CHURN_REASONS.map((r) => (
          <button
            key={r.value}
            type="button"
            role="radio"
            aria-checked={reason === r.value}
            onClick={() => onReason(reason === r.value ? null : r.value)}
            className={cn(
              'rounded-full border px-2.5 py-1 text-[12px] transition-colors',
              reason === r.value
                ? 'border-accent bg-accent-soft text-fg'
                : 'border-border text-muted hover:border-border-strong hover:text-fg',
            )}
          >
            {r.label}
          </button>
        ))}
      </div>
      <textarea
        value={detail}
        onChange={(e) => onDetail(e.target.value)}
        maxLength={500}
        rows={2}
        aria-label="Anything else (optional)"
        placeholder="Anything else? (optional)"
        className="mt-2 w-full resize-none rounded-lg border border-border bg-canvas px-3 py-2 text-[13px] text-fg outline-none placeholder:text-subtle focus:border-border-strong"
      />
    </div>
  )
}

const askedKey = (kind: ChurnKind, scope: string) => `ct_churn_asked_${kind}_${scope}`

/**
 * A one-question survey after a cancellation. Optional and dismissable, and
 * asked once per billing period on this device: somebody who closed it has
 * answered the question of whether they want to answer.
 */
export function ChurnSurvey({ kind, scope }: { kind: ChurnKind; scope: string }) {
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(askedKey(kind, scope)) === '1'
    } catch {
      return false
    }
  })
  const [reason, setReason] = useState<ChurnReason | null>(null)
  const [detail, setDetail] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')

  if (hidden) return null

  const remember = () => {
    try {
      localStorage.setItem(askedKey(kind, scope), '1')
    } catch {
      /* the survey simply asks again next time */
    }
  }

  async function send() {
    setState('sending')
    try {
      await submitChurn(kind, reason, detail)
      remember()
      setState('done')
    } catch {
      setState('error')
    }
  }

  if (state === 'done') {
    return (
      <p role="status" className="mt-3 rounded-lg border border-border bg-surface-2/40 px-3 py-2 text-[12px] text-muted">
        Thank you. That goes straight to the person who builds this.
      </p>
    )
  }

  return (
    <div className="mt-3 rounded-lg border border-border bg-surface-2/40 p-3">
      <p className="text-[13px] font-medium text-fg">Mind telling us why? (optional)</p>
      <p className="mt-0.5 mb-2 text-[12px] text-subtle">One tap is plenty. It helps decide what to fix.</p>
      <ChurnReasonPicker reason={reason} detail={detail} onReason={setReason} onDetail={setDetail} />
      <div className="mt-2 flex items-center justify-end gap-2">
        {state === 'error' && <span className="mr-auto text-[12px] text-danger">That did not send. Try again.</span>}
        <button
          type="button"
          onClick={() => {
            remember()
            setHidden(true)
          }}
          className="rounded-md px-2.5 py-1 text-[12px] font-medium text-muted hover:text-fg"
        >
          No thanks
        </button>
        <button
          type="button"
          disabled={state === 'sending' || (!reason && !detail.trim())}
          onClick={() => void send()}
          className="rounded-md bg-accent px-2.5 py-1 text-[12px] font-medium text-accent-contrast disabled:opacity-50"
        >
          {state === 'sending' ? 'Sending…' : 'Send'}
        </button>
      </div>
    </div>
  )
}
