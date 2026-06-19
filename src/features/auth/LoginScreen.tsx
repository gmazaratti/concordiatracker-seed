import { useState } from 'react'
import { useAuth } from '@/app/providers/auth'
import { Logo } from '@/components/Logo'
import { Button } from '@/components/ui/Button'

const field =
  'w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-[14px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none'

/** The full-screen sign-in gate for the student app. Google is the primary path
 * (once enabled on the project); the email+password form below is the dev/test
 * sign-in for the sandbox accounts. */
export function LoginScreen() {
  const { signInWithGoogle, signInWithPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleGoogle() {
    setError(null)
    const { error } = await signInWithGoogle()
    if (error) {
      setError(
        /not enabled|provider/i.test(error)
          ? "Google sign-in isn't switched on for this project yet — use a test account below."
          : error,
      )
    }
    // On success the browser redirects to Google, then back to /app signed in.
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
          <h1 className="font-display text-[20px] leading-tight font-semibold text-fg">Sign in</h1>
          <p className="mt-1 text-[13px] text-subtle">Welcome back to ConcordiaTracker.</p>

          <button
            type="button"
            onClick={handleGoogle}
            className="mt-5 flex w-full items-center justify-center gap-2.5 rounded-lg border border-border-strong bg-surface-2 px-4 py-2.5 text-[14px] font-medium text-fg transition-colors duration-150 hover:bg-surface"
          >
            <GoogleGlyph />
            Continue with Google
          </button>

          <div className="my-4 flex items-center gap-3 text-[11px] tracking-wide text-subtle uppercase">
            <span className="h-px flex-1 bg-border" aria-hidden />
            or
            <span className="h-px flex-1 bg-border" aria-hidden />
          </div>

          <form onSubmit={handlePassword} className="flex flex-col gap-2.5">
            <label className="block">
              <span className="mb-1 block text-[12px] font-medium text-muted">Email</span>
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
              <span className="mb-1 block text-[12px] font-medium text-muted">Password</span>
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
              {busy ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>

          <p className="mt-3 text-center text-[11px] text-subtle">
            Dev sign-in — use a sandbox test account.
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
