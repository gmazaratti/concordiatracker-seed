import { useEffect, useRef, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { useT } from '@/i18n/i18n'
import { useAuth } from '@/app/providers/auth'
import { Logo } from '@/components/Logo'
import { Button } from '@/components/ui/Button'
import { checkSignup, readAttempts, recordAttempt, waitLabel } from '@/lib/signup-throttle'
import { authReturn, explainAuthError, oauthProblem } from '@/lib/auth-return'
import { ForgotPasswordForm } from './ForgotPasswordForm'
import { AuthShowcase } from './AuthShowcase'
import { Rise } from './Rise'
import { GoogleGlyph } from '@/components/GoogleGlyph'
import { AppleGlyph } from '@/components/AppleGlyph'

/**
 * Both inputs share this one class list, so they cannot drift apart: the same
 * hairline border at rest, sage on focus. The autofill rules repaint Chrome's
 * autofill fill with the canvas colour, which is what used to turn a saved
 * password into a solid, borderless box.
 */
const field =
  'h-11 w-full rounded-xl border border-border bg-canvas px-3.5 text-[14px] text-fg placeholder:text-subtle transition-[border-color,box-shadow] duration-150 focus:border-accent focus:ring-2 focus:ring-accent-ring focus:outline-none autofill:shadow-[inset_0_0_0_1000px_var(--ct-canvas)] autofill:[-webkit-text-fill-color:var(--ct-fg)]'

const label = 'mb-1.5 block text-[12.5px] font-medium text-muted'

/**
 * The full-screen auth gate: sign in, or create an account.
 *
 * LAYOUT: form on the left, a product panel on the right (on a phone, the
 * panel becomes a short strip above the form). Only the look changed here;
 * every handler below is the one the screen always had.
 *
 * Google and Apple are the real paths (both OAuth, both returning through the
 * same callback) and email+password is the third, for anyone who wants an
 * account not tied to either.
 *
 * THE AGREEMENT IS REQUIRED TO CREATE AN ACCOUNT, NOT TO SIGN IN. Someone
 * signing in agreed when they joined; asking again every time is a tick-box
 * that teaches people to tick boxes. In create mode it gates EVERY route in,
 * OAuth included: clicking "Google" makes an account just as much as the form
 * does, so the agreement cannot only guard the half that has a submit button.
 */
export function LoginScreen() {
  const { signInWithGoogle, signInWithApple, signInWithPassword, signUpWithPassword } = useAuth()
  const t = useT()
  const [email, setEmail] = useState('')
  // True for the first load's entrance only (see Rise). 1.8s covers the last
  // step, 900ms of delay plus its 620ms animation.
  const [intro, setIntro] = useState(true)
  useEffect(() => {
    const id = window.setTimeout(() => setIntro(false), 1800)
    return () => window.clearTimeout(id)
  }, [])
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(() => {
    if (!authReturn.error) return null
    // A provider failure says WHICH provider and what to do next, rather than
    // repeating the auth server's "Unable to exchange external code".
    const problem = oauthProblem(authReturn.error)
    if (problem) {
      const provider = problem.provider ?? 'That'
      return problem.kind === 'conflict'
        ? t('auth.oauthConflict', { provider: problem.provider ?? 'it' })
        : t('auth.oauthFailed', { provider })
    }
    return explainAuthError(authReturn.error)
  })
  const [busy, setBusy] = useState(false)
  const [mode, setMode] = useState<'signin' | 'signup' | 'reset'>('signin')
  const [agreed, setAgreed] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const agreeRef = useRef<HTMLInputElement>(null)
  const [showPw, setShowPw] = useState(false)
  // Sessions already persist on this device, so "on" is the truth. Turning it
  // off does not change session handling (out of scope for this screen); it
  // says how to not stay signed in instead of pretending to.
  const [keep, setKeep] = useState(true)
  const creating = mode === 'signup'
  // One gate, checked by the OAuth buttons and the form alike.
  const blocked = creating && !agreed

  function switchMode(next: 'signin' | 'signup' | 'reset') {
    setMode(next)
    setError(null)
    setSentTo(null)
  }

  /**
   * One handler for both buttons.
   *
   * The only difference between them is which provider is asked and which name
   * appears in the "not switched on" message: writing them twice would be two
   * places for the error handling to drift apart.
   */
  async function handleOAuth(provider: 'Google' | 'Apple') {
    if (blocked) {
      // The box is ABOVE the submit button, far from these: say why, and move
      // the cursor to the thing that needs doing.
      setError(t('auth.mustAgree'))
      agreeRef.current?.focus()
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
    // signed in, so there is no success branch to write here.
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
      // Before the request, not after: the point is to not SEND the mail.
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
      // Supabase answers "Invalid login credentials" for a wrong password AND
      // for an account that has no password because it was made with Google or
      // Apple. The message covers both without saying which, so it cannot be
      // used to find out who has an account.
      setError(/invalid login credentials/i.test(error) ? t('auth.wrongPassword') : error)
      setBusy(false)
    }
    // On success the auth listener flips the session and the app renders.
  }

  return (
    <div className="min-h-[100dvh] bg-canvas lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-4 lg:p-4">
      {/* Phone: the form alone, full width. The showcase is a desktop panel. */}
      <main className="flex items-center justify-center px-5 py-10 sm:px-8 lg:py-12">
        <div className="w-full max-w-[400px]">
          <Rise at={100} on={intro} className="mb-10">
            <Logo />
          </Rise>

          {mode === 'reset' ? (
            <ForgotPasswordForm initialEmail={email} onBack={() => switchMode('signin')} bare fieldClass={field} />
          ) : (
            <>
              <Rise at={150} on={intro}>
                <h1 className="font-display text-[34px] leading-[1.05] font-semibold tracking-[-0.03em] text-fg sm:text-[40px]">
                  {creating ? t('auth.createAccount') : t('auth.heroTitle')}
                </h1>
              </Rise>
              <Rise at={200} on={intro}>
                <p className="mt-3 text-[14px] leading-relaxed whitespace-nowrap text-muted">
                  {creating ? t('auth.startTracking') : t('auth.heroSub')}
                </p>
              </Rise>

              {/* The two modes as one segmented control: the active one is the
                  filled pill, the other plain text. It only switches the mode
                  the screen already had (create mode keeps its terms gate). */}
              <Rise at={300} on={intro} className="mt-6">
                <div
                  role="group"
                  aria-label={t('auth.modeLabel')}
                  className="grid grid-cols-2 rounded-full border border-border bg-surface p-1"
                >
                  {(['signin', 'signup'] as const).map((m) => {
                    const active = mode === m
                    return (
                      <button
                        key={m}
                        type="button"
                        aria-pressed={active}
                        onClick={() => !active && switchMode(m)}
                        className={
                          active
                            ? 'h-9 rounded-full border border-border bg-canvas text-[13.5px] font-semibold text-fg shadow-sm transition-transform duration-150 active:scale-[0.98]'
                            : 'h-9 rounded-full border border-transparent text-[13.5px] font-medium text-muted transition-[color,transform] duration-150 hover:text-fg active:scale-[0.98]'
                        }
                      >
                        {m === 'signin' ? t('auth.signIn') : t('auth.createAccount')}
                      </button>
                    )
                  })}
                </div>
              </Rise>

              <form onSubmit={handlePassword} className="mt-6 flex flex-col gap-4">
                <Rise at={400} on={intro}>
                  <label htmlFor="auth-email" className={label}>
                    {t('auth.email')}
                  </label>
                  <input
                    id="auth-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className={field}
                  />
                </Rise>

                <Rise at={450} on={intro}>
                  <label htmlFor="auth-password" className={label}>
                    {t('auth.password')}
                  </label>
                  <div className="relative">
                    <input
                      id="auth-password"
                      type={showPw ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete={creating ? 'new-password' : 'current-password'}
                      className={`${field} pr-11`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw((v) => !v)}
                      aria-label={showPw ? t('auth.hidePassword') : t('auth.showPassword')}
                      aria-pressed={showPw}
                      className="absolute top-1/2 right-1.5 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-subtle transition-colors duration-150 hover:text-fg"
                    >
                      {showPw ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
                    </button>
                  </div>
                  {creating && <span className="mt-1.5 block text-[12px] text-subtle">{t('auth.passwordHint')}</span>}
                </Rise>

                {/* A persistent wrapper, so switching mode does not remount it
                    and replay its entrance; empty:hidden keeps the form's gap
                    honest in create mode, where it has no content. */}
                <Rise at={500} on={intro} className="empty:hidden">
                  {!creating && (
                    <div>
                      <div className="flex items-center justify-between gap-3">
                        <label className="flex cursor-pointer items-center gap-2 text-[13px] text-muted">
                          <input
                            type="checkbox"
                            checked={keep}
                            onChange={(e) => setKeep(e.target.checked)}
                            className="size-4 shrink-0 accent-[var(--ct-accent)]"
                          />
                          {t('auth.keepSignedIn')}
                        </label>
                        <button
                          type="button"
                          onClick={() => switchMode('reset')}
                          className="rounded text-[13px] font-medium text-fg underline decoration-border-strong underline-offset-4 transition-colors hover:decoration-fg"
                        >
                          {t('auth.resetPassword')}
                        </button>
                      </div>
                      {!keep && <p className="mt-2 text-[12px] text-subtle">{t('auth.keepSignedInOff')}</p>}
                    </div>
                  )}
                </Rise>

                {error && (
                  <p
                    role="alert"
                    className="rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-[12.5px] text-danger"
                  >
                    {error}
                  </p>
                )}
                {sentTo && (
                  <p
                    role="status"
                    className="rounded-xl border border-success/30 bg-success/10 px-3.5 py-2.5 text-[12.5px] text-fg"
                  >
                    {t('auth.checkEmail')}
                  </p>
                )}

                {/* ONE LINE, DIRECTLY ABOVE THE BUTTON IT GATES: the last thing
                    read before the last thing pressed, which is where an
                    agreement belongs. */}
                {creating && (
                  <label className="flex cursor-pointer items-center gap-2 text-[13px] leading-snug text-muted">
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

                <Rise at={600} on={intro} className="mt-1">
                  <Button type="submit" size="lg" disabled={busy || blocked} className="w-full rounded-full">
                    {busy
                      ? creating
                        ? t('auth.creating')
                        : t('auth.signingIn')
                      : creating
                        ? t('auth.createAccount')
                        : t('auth.signIn')}
                  </Button>
                </Rise>
              </form>

              <Rise at={700} on={intro} className="my-6 flex items-center gap-3 text-[12px] text-subtle">
                <span className="h-px flex-1 bg-border" aria-hidden />
                {t('auth.orContinue')}
                <span className="h-px flex-1 bg-border" aria-hidden />
              </Rise>

              {/* Full width, one under the other, with the official marks: the
                  whole sentence fits, so it is the visible label too. */}
              <div className="flex flex-col gap-3">
                <Rise at={800} on={intro}>
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => void handleOAuth('Google')}
                    className="w-full gap-2.5 rounded-xl bg-surface hover:bg-surface-2"
                  >
                    <GoogleGlyph />
                    {t('auth.signInGoogle')}
                  </Button>
                </Rise>
                <Rise at={900} on={intro}>
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => void handleOAuth('Apple')}
                    className="w-full gap-2.5 rounded-xl bg-surface hover:bg-surface-2"
                  >
                    <AppleGlyph />
                    {t('auth.signInApple')}
                  </Button>
                </Rise>
              </div>
            </>
          )}
        </div>
      </main>

      {/* Slides in from the right at 300ms, pure CSS. The flow lines live
          INSIDE this panel, so they arrive with it on the first frame rather
          than after it. */}
      <div className="ct-auth-panel-in sticky top-4 hidden h-[calc(100dvh-2rem)] lg:block">
        <AuthShowcase />
      </div>
    </div>
  )
}
