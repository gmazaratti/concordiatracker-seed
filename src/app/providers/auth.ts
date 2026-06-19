import { createContext, useContext } from 'react'
import type { Session, User } from '@supabase/supabase-js'

/**
 * Real authentication (Supabase). The single source of truth for "who is signed
 * in". Components read `user`; the student app gates on it. Sign-in supports
 * Google (primary, once enabled on the project) and email+password (dev/test).
 */
export interface AuthContextValue {
  /** The signed-in user, or null when signed out. */
  user: User | null
  session: Session | null
  /** True until the first session check resolves — avoids a login-screen flash. */
  loading: boolean
  /** Returns `{ error }` (a message) rather than throwing, so screens can show it. */
  signInWithGoogle: () => Promise<{ error: string | null }>
  signInWithPassword: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}
