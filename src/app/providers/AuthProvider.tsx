import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { AuthContext } from './auth'
import { authReturn, rememberOAuthAttempt } from '@/lib/auth-return'

/** Tracks the Supabase session: loads it once, then keeps it in sync via the
 * auth-state listener (covers sign-in, sign-out, token refresh, OAuth return). */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      setLoading(false)
    })
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next)
      /**
       * A PASSWORD-RESET LINK signs you in (that is how Supabase proves you own
       * the address) and then has to take you to the page that asks for the new
       * password, not into the app. Checked by the event AND the URL type,
       * because the link may land on the Site URL rather than /reset-password
       * when the redirect is not on the allow-list (see auth-return.ts).
       */
      if (event === 'PASSWORD_RECOVERY' || authReturn.type === 'recovery') {
        if (next && window.location.pathname !== '/reset-password') {
          window.location.replace('/reset-password')
        }
        return
      }
      /**
       * Land a confirmed user in the APP, not on the marketing page.
       *
       * Supabase replaces a `redirect_to` that is not on its allow-list with
       * the Site URL, which is `/` — so confirming an email drops you on the
       * landing page, signed in, looking at something indistinguishable from
       * being signed out. Measured with a real link before writing this.
       *
       * Only when the URL actually carried a token, so a normal visit to the
       * landing page by someone already signed in is left alone — they may
       * have gone there on purpose.
       */
      if (next && authReturn.hasToken && !window.location.pathname.startsWith('/app')) {
        window.location.replace('/app')
      }
    })
    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  /**
   * The two OAuth providers share one implementation on purpose.
   *
   * Same `redirectTo`, so both come back through the callback the app already
   * handles; the session then arrives via `onAuthStateChange` above exactly as
   * it does for Google, and nothing downstream needs to know which button was
   * pressed. A second flow would be a second thing to keep in step.
   */
  const startOAuth = useCallback(async (provider: 'google' | 'apple') => {
    rememberOAuthAttempt(provider)
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/app` },
    })
    return { error: error?.message ?? null }
  }, [])

  const signInWithGoogle = useCallback(() => startOAuth('google'), [startOAuth])
  const signInWithApple = useCallback(() => startOAuth('apple'), [startOAuth])

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message ?? null }
  }, [])

  /**
   * Create an account with an email and a password.
   *
   * `needsConfirmation` exists because the answer depends on a dashboard
   * setting, not on this code: with auto-confirm on, Supabase returns a
   * session and the app is simply open; with it off, it returns a user and NO
   * session, and the screen has to say "check your email" instead of appearing
   * to do nothing. Reading the result rather than assuming means flipping that
   * setting later does not silently break the sign-up screen.
   */
  const signUpWithPassword = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/app` },
    })
    if (error) return { error: error.message, needsConfirmation: false }
    return { error: null, needsConfirmation: !data.session }
  }, [])

  /**
   * Email a password-reset link. The answer is the same whether or not an
   * account uses that address, so the form cannot be used to find out who has
   * one. The token in the link is single-use and expires (Supabase's email OTP
   * lifetime).
   */
  const sendPasswordReset = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    return { error: error?.message ?? null }
  }, [])

  const updatePassword = useCallback(async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password })
    return { error: error?.message ?? null }
  }, [])

  /** Add a second sign-in method to the account you are signed into. */
  const linkProvider = useCallback(async (provider: 'google' | 'apple') => {
    rememberOAuthAttempt(provider)
    const { error } = await supabase.auth.linkIdentity({
      provider,
      options: { redirectTo: `${window.location.origin}/app?settings=account` },
    })
    return { error: error?.message ?? null }
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  const value = useMemo(
    () => ({
      user: session?.user ?? null,
      session,
      loading,
      signInWithGoogle,
      signInWithApple,
      signInWithPassword,
      signUpWithPassword,
      sendPasswordReset,
      updatePassword,
      linkProvider,
      signOut,
    }),
    [
      session,
      loading,
      signInWithGoogle,
      signInWithApple,
      signInWithPassword,
      signUpWithPassword,
      sendPasswordReset,
      updatePassword,
      linkProvider,
      signOut,
    ],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}
