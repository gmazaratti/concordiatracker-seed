import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useT } from '@/i18n/i18n'
import { useAuth } from '@/app/providers/auth'
import { Button } from '@/components/ui/Button'
import { GoogleGlyph } from '@/components/GoogleGlyph'
import { AppleGlyph } from '@/components/AppleGlyph'
import { checkSignup, readAttempts, recordAttempt, waitLabel } from '@/lib/signup-throttle'
import { authReturn, explainAuthError } from '@/lib/auth-return'
import { cn } from '@/lib/cn'

const field =
  'w-full rounded-xl border border-border bg-surface px-3.5 py-3 text-[14px] text-fg placeholder:text-subtle transition-colors focus:border-accent focus:outline-none'
const oauthBtn =
  'flex h-11 w-full items-center justify-center gap-2.5 rounded-xl border border-border-strong bg-surface px-4 text-[14px] font-medium text-fg transition-colors duration-150 hover:bg-surface-2'

/**
 * The same auth behaviour as the live LoginScreen, in the draft's layout.
 *
 * Deliberately NOT extracted from LoginScreen (the live login must not move),
 * so it calls the same things LoginScreen calls: `useAuth()` for Google, Apple,
 * password sign-in and sign-up; `signup-throttle` before a sign-up is sent;
 * `auth-return` to explain a failed email link. The rules match too: the
 * agreement gates EVERY route in when creating an account (OAuth included),
 * and never when signing in.
 *
 * One difference, because this page is not the /app gate: a password sign-in
 * that succeeds here navigates to /app itself. OAuth already returns there.
 */
export function DevLoginForm() {
  const { user, signInWithGoogle, signInWithApple, signInWithPassword, signUpWithPassword } = useAuth()
  const t = useT()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(
    authReturn.error ? explainAuthError(authReturn.error) : null,
  )
  const [busy, setBusy] = useState(false)
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [agreed, setAgreed] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const agreeRef = useRef<HTMLInputElement>(null)
  const creating = mode === 'signup'
  const blocked = creating && !agreed

  // Only a session that arrives BECAUSE of this form moves you on. Someone
  // already signed in who opens this page to look at it stays on it.
  useEffect(() => {
    if (submitted && user) navigate('/app', { replace: true })
  }, [submitted, user, navigate])

  function switchMode(next: 'signin' | 'signup') {
    setMode(next)
    setError(null)
    setSentTo(null)
  }

  async function handleOAuth(provider: 'Google' | 'Apple') {
    if (blocked) {
      setError(t('auth.mustAgree'))
      agreeRef.current?.focus()
      return
    }
    setError(null)
    const { error } = await (provider === 'Google' ? signInWithGoogle() : signInWithApple())
    if (error) {
      setError(
        /not enabled|provider/i.test(error) ? `${provider} sign-in isn't switched on for this project yet.` : error,
      )
    }
  }

  async function handlePassword(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !password) return
    if (blocked) {
      setError(t('auth.mustAgree'))
      agreeRef.current?.focus()
      return
    }
    if (creating && password.length < 8) {
      setError(t('auth.passwordHint'))
      return
    }
    setBusy(true)
    setError(null)

    if (creating) {
      const now = Date.now()
      const verdict = checkSignup(readAttempts(), email, now)
      if (!verdict.ok) {
        setBusy(false)
        setError(
          verdict.reason === 'email'
            ? `We already sent a link to that address. Check your inbox and spam, or try again in ${waitLabel(verdict.retryAfterMs)}.`
            : `That's a few sign-ups from this browser. Try again in ${waitLabel(verdict.retryAfterMs)}.`,
        )
        return
      }
      recordAttempt(email, now)
      setSubmitted(true)
      const { error, needsConfirmation } = await signUpWithPassword(email.trim(), password)
      setBusy(false)
      if (error) {
        setError(error)
        return
      }
      if (needsConfirmation) setSentTo(email.trim())
      return
    }

    setSubmitted(true)
    const { error } = await signInWithPassword(email.trim(), password)
    if (error) {
      setError(error)
      setBusy(false)
    }
  }

  return (
    <div className="w-full max-w-[380px]">
      <h1 className="font-display text-[28px] leading-tight font-bold tracking-[-0.02em] text-fg">
        {creating ? t('auth.createAccount') : t('auth.signIn')}
      </h1>
      <p className="mt-1.5 text-[14px] text-muted">
        {creating ? t('auth.startTracking') : t('auth.welcomeBack')}
      </p>

      {user && !submitted && (
        <p className="mt-5 rounded-xl border border-border bg-surface px-3.5 py-2.5 text-[12.5px] text-muted">
          Signed in as <span className="text-fg">{user.email}</span>.{' '}
          <button type="button" onClick={() => navigate('/app')} className="font-medium text-accent hover:underline">
            Open the app
          </button>
        </p>
      )}

      <div className="mt-7 flex flex-col gap-2.5">
        <button type="button" onClick={() => void handleOAuth('Google')} className={oauthBtn}>
          <GoogleGlyph />
          {t('auth.signInGoogle')}
        </button>
        <button type="button" onClick={() => void handleOAuth('Apple')} className={oauthBtn}>
          <AppleGlyph />
          {t('auth.signInApple')}
        </button>
      </div>

      <div className="my-6 flex items-center gap-3 text-[11px] tracking-[0.14em] text-subtle uppercase">
        <span className="h-px flex-1 bg-border" aria-hidden />
        {t('auth.or')}
        <span className="h-px flex-1 bg-border" aria-hidden />
      </div>

      <form onSubmit={handlePassword} className="flex flex-col gap-3.5">
        <label className="block">
          <span className="mb-1.5 block text-[12.5px] font-medium text-muted">{t('auth.email')}</span>
          <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className={field} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[12.5px] font-medium text-muted">{t('auth.password')}</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete={creating ? 'new-password' : 'current-password'}
            className={field}
          />
          {creating && <span className="mt-1.5 block text-[12px] text-subtle">{t('auth.passwordHint')}</span>}
        </label>

        {error && (
          <p role="alert" className="rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-[12.5px] text-danger">
            {error}
          </p>
        )}
        {sentTo && (
          <p role="status" className="rounded-xl border border-success/30 bg-success/10 px-3.5 py-2.5 text-[12.5px] text-fg">
            {t('auth.checkEmail')}
          </p>
        )}

        {creating && (
          <label className="flex cursor-pointer items-center gap-2.5 text-[12.5px] leading-snug text-muted">
            <input
              ref={agreeRef}
              type="checkbox"
              checked={agreed}
              onChange={(e) => {
                setAgreed(e.target.checked)
                if (e.target.checked) setError(null)
              }}
              className="size-4 shrink-0 accent-[var(--ct-accent)]"
            />
            <span>
              {t('auth.agreePre')}{' '}
              <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                {t('auth.termsShort')}
              </a>{' '}
              {t('auth.and')}{' '}
              <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                {t('auth.privacy')}
              </a>
            </span>
          </label>
        )}

        <Button type="submit" size="lg" disabled={busy || blocked} className={cn('mt-1 h-11 w-full')}>
          {busy
            ? creating
              ? t('auth.creating')
              : t('auth.signingIn')
            : creating
              ? t('auth.createAccount')
              : t('auth.signIn')}
        </Button>
      </form>

      <p className="mt-6 text-[13px] text-subtle">
        {creating ? t('auth.haveAccount') : t('auth.noAccount')}{' '}
        <button type="button" onClick={() => switchMode(creating ? 'signin' : 'signup')} className="font-medium text-accent hover:underline">
          {creating ? t('auth.signInInstead') : t('auth.createOne')}
        </button>
      </p>
    </div>
  )
}
