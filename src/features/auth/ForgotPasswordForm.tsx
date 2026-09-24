import { useState } from 'react'
import { ArrowLeft, MailCheck } from 'lucide-react'
import { useT } from '@/i18n/i18n'
import { useAuth } from '@/app/providers/auth'
import { Button } from '@/components/ui/Button'

const field =
  'w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-[14px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none'

/** Seconds before the same browser may ask again. Supabase has its own
 *  server-side email limit; this only stops a double press sending two. */
const RESEND_AFTER_S = 60

/**
 * "Forgot password?" — asks for the email and sends the reset link.
 *
 * THE ANSWER NEVER SAYS WHETHER THE ACCOUNT EXISTS. Success and "no such
 * address" read the same, or this box becomes a way to test which emails have
 * an account. The only error shown is one the person can act on (a malformed
 * address, or the server refusing because of its own rate limit).
 */
export function ForgotPasswordForm({
  initialEmail,
  onBack,
  bare = false,
  fieldClass,
}: {
  initialEmail: string
  onBack: () => void
  /** No card around it: the sign-in screen's left column is already the frame. */
  bare?: boolean
  /** The caller's input style, so the field matches the form it replaced. */
  fieldClass?: string
}) {
  const t = useT()
  const { sendPasswordReset } = useAuth()
  const [email, setEmail] = useState(initialEmail)
  const [busy, setBusy] = useState(false)
  const [sentAt, setSentAt] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const address = email.trim()
    if (!address || busy) return
    if (sentAt && Date.now() - sentAt < RESEND_AFTER_S * 1000) return
    setBusy(true)
    setError(null)
    const { error } = await sendPasswordReset(address)
    setBusy(false)
    // "User not found" style answers are swallowed on purpose (see header).
    if (error && /rate|limit|seconds|security purposes/i.test(error)) {
      setError(error)
      return
    }
    if (error && /invalid.*email|email.*invalid/i.test(error)) {
      setError(error)
      return
    }
    setSentAt(Date.now())
  }

  return (
    <div className={bare ? '' : 'rounded-2xl border border-border bg-surface p-6'}>
      <h1
        className={
          bare
            ? 'font-display text-[34px] leading-[1.05] font-semibold tracking-[-0.03em] text-fg'
            : 'font-display text-[20px] leading-tight font-semibold text-fg'
        }
      >
        {t('auth.resetTitle')}
      </h1>
      <p className={bare ? 'mt-3 text-[14px] leading-relaxed text-muted' : 'mt-1 text-[13px] text-subtle'}>
        {t('auth.resetIntro')}
      </p>

      <form onSubmit={submit} className="mt-5 flex flex-col gap-2.5">
        <label className="block">
          <span className="mb-1 block text-[12px] font-medium text-muted">{t('auth.email')}</span>
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className={fieldClass ?? field}
          />
        </label>

        {error && (
          <p role="alert" className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-[12px] text-danger">
            {error}
          </p>
        )}
        {sentAt && (
          <p
            role="status"
            className="flex items-start gap-2 rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-[12px] text-fg"
          >
            <MailCheck size={15} className="mt-0.5 shrink-0 text-success" aria-hidden />
            <span>{t('auth.resetSent')}</span>
          </p>
        )}

        <Button type="submit" disabled={busy || !email.trim()} className="mt-1 w-full">
          {busy ? t('auth.resetSending') : t('auth.resetSend')}
        </Button>
      </form>

      <button
        type="button"
        onClick={onBack}
        className="mx-auto mt-4 flex items-center gap-1.5 text-[12.5px] font-medium text-accent hover:underline"
      >
        <ArrowLeft size={14} aria-hidden />
        {t('auth.backToSignIn')}
      </button>
    </div>
  )
}
