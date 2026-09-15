import { createContext, useContext } from 'react'
import type { Session, User } from '@supabase/supabase-js'

/**
 * Real authentication (Supabase). The single source of truth for "who is signed
 * in". Components read `user`; the student app gates on it. Sign-in supports
 * Google and Apple (both OAuth, both returning to the same callback) plus
 * email+password (dev/test).
 */
export interface AuthContextValue {
  /** The signed-in user, or null when signed out. */
  user: User | null
  session: Session | null
  /** True until the first session check resolves — avoids a login-screen flash. */
  loading: boolean
  /** Returns `{ error }` (a message) rather than throwing, so screens can show it. */
  signInWithGoogle: () => Promise<{ error: string | null }>
  /** Same contract, same callback, same routing — only the provider differs. */
  signInWithApple: () => Promise<{ error: string | null }>
  signInWithPassword: (email: string, password: string) => Promise<{ error: string | null }>
  /**
   * Create an account. `needsConfirmation` is true when the project requires
   * the address to be verified first — in that case no session is returned and
   * the screen must say so rather than looking like nothing happened.
   */
  signUpWithPassword: (
    email: string,
    password: string,
  ) => Promise<{ error: string | null; needsConfirmation: boolean }>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}
