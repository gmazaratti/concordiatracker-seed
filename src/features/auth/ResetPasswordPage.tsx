import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CircleCheck, Loader2 } from 'lucide-react'
import { useT } from '@/i18n/i18n'
import { useAuth } from '@/app/providers/auth'
import { Logo } from '@/components/Logo'
import { Button } from '@/components/ui/Button'
import { ForgotPasswordForm } from './ForgotPasswordForm'

const field =
  'w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-[14px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none'

/**
 * `/reset-password`: where a reset email lands.
 *
 * Supabase signs the person in from the link (that is the proof they own the
 * address), so this page only has to ask for the new password and save it.
 * Without a session, the link was dead (expired or already used): the page
 * says so and offers a new link in place, instead of a
 * blank form that fails on submit.
 */
export function ResetPasswordPage() {
  const t = useT()
  const { user, loading, updatePassword } = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) return setError(t('auth.passwordHint'))
    if (password !== confirm) return setError(t('auth.passwordsDiffer'))
    setBusy(true)
    setError(null)
    const res = await updatePassword(password)
    setBusy(false)
    if (res.error) return setError(res.error)
    setDone(true)
  }

  let body: React.ReactNode
  if (loading) {
    body = (
      <div className="grid place-items-center py-10">
        <Loader2 className="size-6 animate-spin text-accent" aria-label="Loading" />
      </div>
    )
  } else if (!user) {
    body = (
      <>
        <p role="alert" className="mb-3 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-[12.5px] text-fg">
          {t('auth.resetLinkDead')}
        </p>
        <ForgotPasswordForm initialEmail="" onBack={() => window.location.assign('/app')} />
      </>
    )
  } else if (done) {
    body = (
      <div className="rounded-2xl border border-border bg-surface p-6 text-center">
        <CircleCheck size={32} className="mx-auto text-success" aria-hidden />
        <p className="mt-3 text-[14px] text-fg">{t('auth.passwordSaved')}</p>
        <Link to="/app" className="mt-5 inline-block">
          <Button>{t('auth.openApp')}</Button>
        </Link>
      </div>
    )
  } else {
    body = (
      <div className="rounded-2xl border border-border bg-surface p-6">
        <h1 className="font-display text-[20px] leading-tight font-semibold text-fg">{t('auth.newPasswordTitle')}</h1>
        <p className="mt-1 text-[13px] text-subtle">
          {t('auth.newPasswordIntro')} {user.email && <span className="text-muted">({user.email})</span>}
        </p>
        <form onSubmit={submit} className="mt-5 flex flex-col gap-2.5">
          {/* The address as a hidden username, so a password manager files the
              new password under the right account. */}
          <input type="email" autoComplete="username" value={user.email ?? ''} readOnly hidden />
          <label className="block">
            <span className="mb-1 block text-[12px] font-medium text-muted">{t('auth.newPassword')}</span>
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={field}
            />
            <span className="mt-1 block text-[11.5px] text-subtle">{t('auth.passwordHint')}</span>
          </label>
          <label className="block">
            <span className="mb-1 block text-[12px] font-medium text-muted">{t('auth.confirmPassword')}</span>
            <input
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={field}
            />
          </label>
          {error && (
            <p role="alert" className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-[12px] text-danger">
              {error}
            </p>
          )}
          <Button type="submit" disabled={busy || !password || !confirm} className="mt-1 w-full">
            {busy ? t('auth.saving') : t('auth.savePassword')}
          </Button>
        </form>
      </div>
    )
  }

  return (
    <div className="grid min-h-[100dvh] place-items-center bg-canvas px-5">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <Logo size="lg" />
        </div>
        {body}
      </div>
    </div>
  )
}
