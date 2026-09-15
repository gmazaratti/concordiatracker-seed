import { useState } from 'react'
import { useT } from '@/i18n/i18n'
import { useAuth } from '@/app/providers/auth'
import { Logo } from '@/components/Logo'
import { Button } from '@/components/ui/Button'
import { AppleGlyph } from '@/components/AppleGlyph'

const field =
  'w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-[14px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none'

/** Shared by both OAuth buttons, so they cannot drift apart visually. */
const oauthBtn =
  'flex w-full items-center justify-center gap-2.5 rounded-lg border border-border-strong bg-surface-2 px-4 py-2.5 text-[14px] font-medium text-fg transition-colors duration-150 hover:bg-surface disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-surface-2'

/**
 * The full-screen auth gate: sign in, or create an account.
 *
 * Google and Apple are the real paths — both OAuth, both returning through the
 * same callback — and email+password is the third, for anyone who wants an
 * account not tied to either.
 *
 * THE AGREEMENT IS REQUIRED TO CREATE AN ACCOUNT, NOT TO SIGN IN. Someone
 * signing in agreed when they joined; asking again every time is a tick-box
 * that teaches people to tick boxes. In create mode it gates EVERY route in,
 * OAuth included — clicking "Google" makes an account just as much as the form
 * does, so the agreement cannot only guard the half that happens to have a
 * submit button.
 */
export function LoginScreen() {
  const { signInWithGoogle, signInWithApple, signInWithPassword, signUpWithPassword } = useAuth()
  const t = useT()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [agreed, setAgreed] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const creating = mode === 'signup'
  // One gate, checked by the OAuth buttons and the form alike.
  const blocked = creating && !agreed

  function switchMode(next: 'signin' | 'signup') {
    setMode(next)
    setError(null)
    setSentTo(null)
  }

  /**
   * One handler for both buttons.
   *
   * The only difference between them is which provider is asked and which name
   * appears in the "not switched on" message — writing them twice would be two
   * places for the error handling to drift apart.
   */
  async function handleOAuth(provider: 'Google' | 'Apple') {
    if (blocked) {
      setError(t('auth.mustAgree'))
      return
    }
    setError(null)
    const { error } = await (provider === 'Google' ? signInWithGoogle() : signInWithApple())
    if (error) {
      setError(
        /not enabled|provider/i.test(error)
          ? `${provider} sign-in isn't switched on for this project yet: use a test account below.`
          : error,
      )
    }
    // On success the browser leaves for the provider and returns to /app
    // signed in — so there is no success branch to write here.
  }

  async function handlePassword(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !password) return
    if (blocked) {
      setError(t('auth.mustAgree'))
      return
    }
    if (creating && password.length < 8) {
      setError(t('auth.passwordHint'))
      return
    }
    setBusy(true)
    setError(null)

    if (creating) {
      const { error, needsConfirmation } = await signUpWithPassword(email.trim(), password)
      setBusy(false)
      if (error) {
        setError(error)
        return
      }
      // Whether a session comes back is a project setting, so the screen reads
      // the answer instead of assuming: confirmed accounts fall through to the
      // app on their own, unconfirmed ones need to be told to go to their mail.
      if (needsConfirmation) setSentTo(email.trim())
      return
    }

    const { error } = await signInWithPassword(email.trim(), password)
    if (error) {
      setError(error)
      setBusy(false)
    }
    // On success the auth listener flips the session → the app renders. No nav needed.
  }

  return (
    <div className="grid min-h-svh place-items-center bg-canvas px-5">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <Logo size="lg" />
        </div>

        <div className="rounded-2xl border border-border bg-surface p-6">
          <h1 className="font-display text-[20px] leading-tight font-semibold text-fg">
            {creating ? t('auth.createAccount') : t('auth.signIn')}
          </h1>
          <p className="mt-1 text-[13px] text-subtle">
            {creating ? t('auth.startTracking') : t('auth.welcomeBack')}
          </p>

          {/* The agreement sits ABOVE everything it gates, because a checkbox
              under the buttons it governs is one people meet after they have
              already tried to press one. */}
          {creating && (
            <label className="mt-4 flex cursor-pointer items-start gap-2.5 rounded-lg border border-border bg-surface-2/40 px-3 py-2.5">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => {
                  setAgreed(e.target.checked)
                  if (e.target.checked) setError(null)
                }}
                className="mt-0.5 size-4 shrink-0 accent-[var(--ct-accent)]"
              />
              <span className="text-[12.5px] leading-relaxed text-muted">
                {t('auth.agreePre')}{' '}
                <a href="/terms" target="_blank" rel="noopener noreferrer" className="font-medium text-accent hover:underline">
                  {t('auth.terms')}
                </a>{' '}
                {t('auth.and')}{' '}
                <a href="/privacy" target="_blank" rel="noopener noreferrer" className="font-medium text-accent hover:underline">
                  {t('auth.privacy')}
                </a>
                .
              </span>
            </label>
          )}

          {/* SIDE BY SIDE, WITH THE PROVIDER NAME ALONE. Two buttons in a
              384px card leave ~160px each, and "Continue with Google" does not
              fit that without wrapping or an ellipsis. The full sentence moves
              to aria-label so a screen reader still hears the whole thing —
              the visible word is unambiguous under a heading that says "Sign
              in", and a truncated label would be worse than a short one. */}
          <div className="mt-5 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => void handleOAuth('Google')}
              aria-label={t('auth.signInGoogle')}
              disabled={blocked}
              className={oauthBtn}
            >
              <GoogleGlyph />
              {t('auth.google')}
            </button>
            <button
              type="button"
              onClick={() => void handleOAuth('Apple')}
              aria-label={t('auth.signInApple')}
              disabled={blocked}
              className={oauthBtn}
            >
              <AppleGlyph />
              {t('auth.apple')}
            </button>
          </div>

          <div className="my-4 flex items-center gap-3 text-[11px] tracking-wide text-subtle uppercase">
            <span className="h-px flex-1 bg-border" aria-hidden />
            {t('auth.or')}
            <span className="h-px flex-1 bg-border" aria-hidden />
          </div>

          <form onSubmit={handlePassword} className="flex flex-col gap-2.5">
            <label className="block">
              <span className="mb-1 block text-[12px] font-medium text-muted">{t('auth.email')}</span>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className={field}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[12px] font-medium text-muted">{t('auth.password')}</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete={creating ? 'new-password' : 'current-password'}
                className={field}
              />
              {creating && (
                <span className="mt-1 block text-[11.5px] text-subtle">{t('auth.passwordHint')}</span>
              )}
            </label>

            {error && (
              <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-[12px] text-danger">
                {error}
              </p>
            )}
            {sentTo && (
              <p className="rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-[12px] text-fg">
                {t('auth.checkEmail')}
              </p>
            )}

            <Button type="submit" disabled={busy || blocked} className="mt-1 w-full">
              {busy
                ? creating
                  ? t('auth.creating')
                  : t('auth.signingIn')
                : creating
                  ? t('auth.createAccount')
                  : t('auth.signIn')}
            </Button>
          </form>

          <p className="mt-4 text-center text-[12.5px] text-subtle">
            {creating ? t('auth.haveAccount') : t('auth.noAccount')}{' '}
            <button
              type="button"
              onClick={() => switchMode(creating ? 'signin' : 'signup')}
              className="font-medium text-accent hover:underline"
            >
              {creating ? t('auth.signInInstead') : t('auth.createOne')}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}

/** The Google "G" mark (official 4-colour). */
function GoogleGlyph() {
  return (
    <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#4285F4"
        d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"
      />
      <path
        fill="#34A853"
        d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"
      />
      <path
        fill="#FBBC05"
        d="M11.69 28.18c-.44-1.32-.69-2.73-.69-4.18s.25-2.86.69-4.18v-5.7H4.34A21.99 21.99 0 0 0 2 24c0 3.55.85 6.91 2.34 9.88l7.35-5.7z"
      />
      <path
        fill="#EA4335"
        d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"
      />
    </svg>
  )
}
