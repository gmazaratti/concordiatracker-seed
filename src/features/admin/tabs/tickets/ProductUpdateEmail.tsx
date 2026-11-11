import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, Mail } from 'lucide-react'
import { ModalShell } from '@/command/ModalShell'
import { supabase } from '@/lib/supabase'

async function call(payload: Record<string, unknown>): Promise<{ recipients?: number; sent?: number; error?: string }> {
  const { data } = await supabase.auth.getSession()
  const jwt = data.session?.access_token
  if (!jwt) return { error: 'Sign in again.' }
  const res = await fetch('/api/admin?action=product-update', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
    body: JSON.stringify(payload),
  })
  return res.json().catch(() => ({ error: 'The server did not answer.' }))
}

/**
 * "Email a product update" to everyone who switched Product updates on
 * (api/admin.ts, product-update). Shows how many will get it before sending,
 * and sends only on a second, explicit press.
 */
export function ProductUpdateEmail({ onClose }: { onClose: () => void }) {
  const [subject, setSubject] = useState('')
  const [text, setText] = useState('')
  const [count, setCount] = useState<number | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  useEffect(() => {
    void call({ subject: 'count', text: 'count', dryRun: true }).then((r) => setCount(r.recipients ?? 0))
  }, [])

  async function send() {
    setBusy(true)
    const r = await call({ subject, text })
    setBusy(false)
    setResult(r.error ?? `Sent to ${r.sent ?? 0} of ${r.recipients ?? 0}.`)
  }

  const field = 'w-full rounded-lg border border-border bg-canvas px-3 py-2 text-[13px] text-fg outline-none focus:border-accent'
  return createPortal(
    <ModalShell label="Email a product update" onClose={onClose}>
      <div className="max-h-[85dvh] overflow-y-auto p-5">
        <h2 className="flex items-center gap-2 text-[17px] font-bold text-fg">
          <Mail size={16} className="text-accent" aria-hidden /> Email a product update
        </h2>
        <p className="mt-1 text-[12.5px] text-subtle">
          Goes only to people who turned on Product updates in Settings
          {count === null ? '' : ` (${count} right now)`}. Separate paragraphs with a blank line.
        </p>
        <label className="mt-4 block text-[12px] font-medium text-muted">Subject</label>
        <input value={subject} onChange={(e) => setSubject(e.target.value)} className={`${field} mt-1`} />
        <label className="mt-3 block text-[12px] font-medium text-muted">Message</label>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={10} className={`${field} mt-1 resize-y`} />
        {result && (
          <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-success/10 px-3 py-2 text-[12.5px] text-fg">
            <Check size={14} className="text-success" aria-hidden /> {result}
          </p>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-[13px] text-muted hover:text-fg">
            {result ? 'Done' : 'Cancel'}
          </button>
          {!result && (
            <button
              type="button"
              disabled={busy || subject.trim().length < 3 || !text.trim() || !count}
              onClick={() => (confirming ? void send() : setConfirming(true))}
              className="rounded-lg bg-accent px-4 py-2 text-[13px] font-semibold text-accent-contrast disabled:opacity-40"
            >
              {busy ? 'Sending' : confirming ? `Yes, send to ${count}` : 'Send'}
            </button>
          )}
        </div>
      </div>
    </ModalShell>,
    document.body,
  )
}
