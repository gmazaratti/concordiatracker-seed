import { useState } from 'react'
import { useT } from '@/i18n/i18n'
import { useAuth } from '@/app/providers/auth'
import { Logo } from '@/components/Logo'
import { Button } from '@/components/ui/Button'

const field =
  'w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-[14px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none'

/** Shared by both OAuth buttons, so they cannot drift apart visually. */
const oauthBtn =
  'flex w-full items-center justify-center gap-2.5 rounded-lg border border-border-strong bg-surface-2 px-4 py-2.5 text-[14px] font-medium text-fg transition-colors duration-150 hover:bg-surface'

/** The full-screen sign-in gate for the student app. Google and Apple are the
 * real paths — both OAuth, both returning through the same callback; the
 * email+password form below is the dev/test sign-in for the sandbox accounts. */
export function LoginScreen() {
  const { signInWithGoogle, signInWithApple, signInWithPassword } = useAuth()
  const t = useT()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  /**
   * One handler for both buttons.
   *
   * The only difference between them is which provider is asked and which name
   * appears in the "not switched on" message — writing them twice would be two
   * places for the error handling to drift apart.
   */
  async function handleOAuth(provider: 'Google' | 'Apple') {
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
    setBusy(true)
    setError(null)
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
          <h1 className="font-display text-[20px] leading-tight font-semibold text-fg">{t('auth.signIn')}</h1>
          <p className="mt-1 text-[13px] text-subtle">{t('auth.welcomeBack')}</p>

          <div className="mt-5 flex flex-col gap-2">
            <button type="button" onClick={() => void handleOAuth('Google')} className={oauthBtn}>
              <GoogleGlyph />
              {t('auth.signInGoogle')}
            </button>
            <button type="button" onClick={() => void handleOAuth('Apple')} className={oauthBtn}>
              <AppleGlyph />
              {t('auth.signInApple')}
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
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className={field}
              />
            </label>

            {error && (
              <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-[12px] text-danger">
                {error}
              </p>
            )}

            <Button type="submit" disabled={busy} className="mt-1 w-full">
              {busy ? t('auth.signingIn') : t('auth.signIn')}
            </Button>
          </form>

          <p className="mt-3 text-center text-[11px] text-subtle">
            {t('auth.devNote')}
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

/**
 * The Apple mark.
 *
 * `currentColor`, not black: Apple's guidelines allow a white or black mark
 * depending on the button, and this button is themed — a hard-coded black
 * logo disappears on the dark surface it sits on.
 */
function AppleGlyph() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.05 12.94c-.03-2.64 2.16-3.91 2.26-3.97-1.23-1.8-3.15-2.05-3.83-2.08-1.63-.16-3.18.96-4.01.96-.82 0-2.1-.94-3.45-.91-1.78.03-3.42 1.03-4.33 2.62-1.84 3.2-.47 7.94 1.32 10.54.88 1.27 1.93 2.7 3.31 2.65 1.33-.05 1.83-.86 3.44-.86 1.6 0 2.06.86 3.46.83 1.43-.02 2.34-1.3 3.21-2.58 1.01-1.48 1.43-2.91 1.45-2.99-.03-.01-2.78-1.07-2.81-4.24zM14.5 5.2c.73-.88 1.22-2.11 1.09-3.33-1.05.04-2.32.7-3.07 1.58-.67.78-1.26 2.02-1.1 3.22 1.17.09 2.36-.6 3.08-1.47z" />
    </svg>
  )
}
