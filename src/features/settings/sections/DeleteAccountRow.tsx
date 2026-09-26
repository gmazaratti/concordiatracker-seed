import { useState } from 'react'
import { Loader2, Trash2 } from 'lucide-react'
import { useAuth } from '@/app/providers/auth'
import { deleteMyAccount } from '@/lib/billing'
import { submitChurn, type ChurnReason } from '@/lib/churn'
import { ChurnReasonPicker } from './ChurnSurvey'

/**
 * Settings → Account → Delete account. REAL: it cancels any subscription, then
 * deletes every row and file that identifies the person (api/_delete-account.ts
 * + db/account_deletion.sql), then the account itself.
 *
 * The optional reason is sent first and the deletion second, so the answer is
 * kept (as an anonymous reason and plan, never the free text or an id) even
 * though the account it came from is gone a second later.
 *
 * Typing DELETE is the confirmation, because this is the one button in the app
 * that cannot be undone by anyone, including us.
 */
export function DeleteAccountRow() {
  const { signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const [reason, setReason] = useState<ChurnReason | null>(null)
  const [detail, setDetail] = useState('')
  const [state, setState] = useState<'idle' | 'deleting' | 'done' | 'error'>('idle')
  const [error, setError] = useState('')

  async function run() {
    setState('deleting')
    setError('')
    // The survey first; it must never stand in the way, so a failure is ignored.
    await submitChurn('account_delete', reason, detail).catch(() => false)
    try {
      await deleteMyAccount()
    } catch (e) {
      setState('error')
      setError((e as Error).message || 'Your account could not be deleted. Nothing was removed.')
      return
    }
    setState('done')
    // Forget this browser's copies too: preferences, analytics ids, first touch.
    try {
      for (const k of Object.keys(localStorage)) if (k.startsWith('ct_')) localStorage.removeItem(k)
      sessionStorage.clear()
    } catch {
      /* nothing stored, nothing to forget */
    }
    await signOut().catch(() => {})
  }

  if (state === 'done') {
    return (
      <div className="px-4 py-3.5" role="status">
        <p className="text-[13px] font-medium text-fg">Your account has been deleted.</p>
        <p className="mt-1 text-[12px] text-subtle">
          Everything tied to it is gone. Thank you for having used ConcordiaTracker.
        </p>
        <a href="/" className="mt-2 inline-block text-[12.5px] font-medium text-accent hover:text-accent-hover">
          Go to the homepage
        </a>
      </div>
    )
  }

  return (
    <div className="px-4 py-3.5">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[13px] font-medium text-danger">
            <Trash2 size={14} aria-hidden />
            Delete account
          </p>
          <p className="mt-0.5 text-[12px] text-subtle">
            Permanently removes your account and everything in it. This cannot be undone.
          </p>
        </div>
        {!open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="shrink-0 rounded-lg border border-danger/40 px-3 py-1.5 text-[12px] font-medium text-danger transition-colors hover:bg-danger/10"
          >
            Delete
          </button>
        )}
      </div>

      {open && (
        <div className="mt-3 rounded-lg border border-danger/30 bg-danger/5 p-3 text-[12px]">
          <p className="font-medium text-fg">What happens</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-muted">
            <li>Your profile, courses, grades, tasks, messages, follows, notes and settings are deleted.</li>
            <li>So are your support tickets, bug reports, survey answers, device history, analytics and uploaded files.</li>
            <li>A Pro subscription is cancelled immediately. Stripe keeps its own payment records, as the law requires.</li>
            <li>Posts and events you published for a club stay with the club, without your name.</li>
            <li>We keep only an anonymous count of deletions, and your reason below if you give one, with nothing that identifies you.</li>
          </ul>

          <div className="mt-3">
            <p className="mb-1.5 text-muted">Mind telling us why? (optional)</p>
            <ChurnReasonPicker reason={reason} detail={detail} onReason={setReason} onDetail={setDetail} />
          </div>

          <label className="mt-3 block">
            <span className="text-muted">
              Type <strong className="font-semibold text-fg">DELETE</strong> to confirm
            </span>
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              aria-label="Type DELETE to confirm"
              className="mt-1 w-full rounded-lg border border-border bg-canvas px-2.5 py-1.5 text-[13px] text-fg outline-none focus:border-danger/60"
            />
          </label>

          {error && (
            <p role="alert" className="mt-2 text-danger">
              {error}
            </p>
          )}

          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              disabled={state === 'deleting'}
              onClick={() => {
                setOpen(false)
                setTyped('')
                setError('')
              }}
              className="rounded-md px-2.5 py-1 font-medium text-muted hover:text-fg"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={typed.trim() !== 'DELETE' || state === 'deleting'}
              onClick={() => void run()}
              className="inline-flex items-center gap-1.5 rounded-md bg-danger px-2.5 py-1 font-medium text-white disabled:opacity-50"
            >
              {state === 'deleting' && <Loader2 size={13} className="animate-spin" aria-hidden />}
              {state === 'deleting' ? 'Deleting…' : 'Delete my account'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
