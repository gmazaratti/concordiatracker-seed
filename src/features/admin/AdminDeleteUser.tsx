import { useState } from 'react'
import { supabase } from '@/lib/supabase'

/**
 * Carry out an emailed deletion request (the privacy policy's "By email"
 * path). Same deletion as the user's own button (api/_delete-account.ts),
 * through /api/admin?action=delete-user, which refuses agent tokens and
 * admin accounts. Typing the account's email is the confirmation.
 */
export function AdminDeleteUser({ userId, email, onDeleted }: { userId: string; email: string; onDeleted: () => void }) {
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle')
  const [message, setMessage] = useState('')

  async function run() {
    setState('busy')
    const { data } = await supabase.auth.getSession()
    const res = await fetch('/api/admin?action=delete-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token ?? ''}` },
      body: JSON.stringify({ userId, confirmEmail: typed }),
    }).catch(() => null)
    const json = (await res?.json().catch(() => ({}))) as { error?: string; filesRemoved?: number } | undefined
    if (!res?.ok) {
      setState('error')
      setMessage(json?.error ?? 'The account could not be deleted.')
      return
    }
    setState('done')
    setMessage(`Deleted, with ${json?.filesRemoved ?? 0} file(s). Only an anonymous count remains.`)
    onDeleted()
  }

  if (state === 'done') return <p className="rounded-lg border border-border bg-surface p-3 text-[12.5px] text-muted" role="status">{message}</p>

  return (
    <div className="rounded-lg border border-danger/30 bg-danger/5 p-3">
      <p className="text-[12.5px] font-medium text-danger">Delete this account on request</p>
      <p className="mt-0.5 text-[12px] text-muted">
        Permanent. Cancels billing, then removes everything that identifies them, including tickets, reports and survey
        answers. Use only for a request from the account owner.
      </p>
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="mt-2 rounded-md border border-danger/40 px-2.5 py-1 text-[12px] font-medium text-danger hover:bg-danger/10">
          Delete account…
        </button>
      ) : (
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={`Type ${email} to confirm`}
            aria-label="Type the account email to confirm"
            autoComplete="off"
            className="min-w-0 flex-1 rounded-md border border-border bg-canvas px-2.5 py-1.5 text-[12.5px] text-fg outline-none focus:border-danger/60"
          />
          <button
            type="button"
            disabled={state === 'busy' || typed.trim().toLowerCase() !== email.toLowerCase()}
            onClick={() => void run()}
            className="rounded-md bg-danger px-2.5 py-1.5 text-[12px] font-medium text-white disabled:opacity-50"
          >
            {state === 'busy' ? 'Deleting…' : 'Delete permanently'}
          </button>
        </div>
      )}
      {state === 'error' && <p role="alert" className="mt-2 text-[12px] text-danger">{message}</p>}
    </div>
  )
}
