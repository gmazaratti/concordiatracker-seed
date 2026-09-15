import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { AuthContext } from './auth'

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
    } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
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
      signOut,
    }),
    [
      session,
      loading,
      signInWithGoogle,
      signInWithApple,
      signInWithPassword,
      signUpWithPassword,
      signOut,
    ],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}
