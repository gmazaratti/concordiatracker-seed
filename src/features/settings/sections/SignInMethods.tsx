import { useEffect, useState } from 'react'
import { Check, Loader2, Mail } from 'lucide-react'
import type { UserIdentity } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/app/providers/auth'
import { GoogleGlyph } from '@/components/GoogleGlyph'
import { AppleGlyph } from '@/components/AppleGlyph'
import { Group, Row } from '../controls'

type Method = 'google' | 'apple' | 'email'

const LABEL: Record<Method, string> = { google: 'Google', apple: 'Apple', email: 'Email and password' }

/**
 * Settings → Account → Sign-in methods.
 *
 * One account, several ways in. The real case behind it: somebody signs up with
 * Google, later taps Apple on a phone with the same address, and either lands
 * in a second, empty account (Apple "Hide My Email") or gets turned away. The
 * fix is to sign in the original way and ADD the other method here, which
 * attaches it to this account instead of making a new one.
 *
 * It reads the identities the auth server holds rather than guessing, so the
 * badges are true: this screen used to say "Connected with Google" to every
 * user, including people who never touched Google.
 */
export function SignInMethods() {
  const { linkProvider } = useAuth()
  const [ids, setIds] = useState<UserIdentity[] | null>(null)
  const [busy, setBusy] = useState<Method | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void supabase.auth.getUserIdentities().then(({ data }) => {
      if (active) setIds(data?.identities ?? [])
    })
    return () => {
      active = false
    }
  }, [])

  const has = (m: Method) => !!ids?.some((i) => i.provider === m)

  async function add(m: 'google' | 'apple') {
    setBusy(m)
    setError(null)
    const { error } = await linkProvider(m)
    // On success the browser leaves for the provider and comes back here.
    if (error) {
      setBusy(null)
      setError(
        /manual linking is disabled|manual_linking/i.test(error)
          ? `Adding ${LABEL[m]} to an existing account is not switched on yet. It will be shortly; until then, keep signing in the way you do now.`
          : error,
      )
    }
  }

  return (
    <Group label="Sign-in methods">
      {(['google', 'apple', 'email'] as const).map((m) => (
        <Row
          key={m}
          label={LABEL[m]}
          description={
            m === 'email'
              ? has('email')
                ? 'You can sign in with your email and password.'
                : 'No password yet. To add one, use Forgot password on the sign-in screen.'
              : has(m)
                ? `You can sign in with ${LABEL[m]}.`
                : `Add ${LABEL[m]} so it opens this same account.`
          }
        >
          <span className="flex items-center gap-2">
            {m === 'google' ? <GoogleGlyph /> : m === 'apple' ? <AppleGlyph /> : <Mail size={15} className="text-muted" aria-hidden />}
            {ids === null ? (
              <Loader2 size={14} className="animate-spin text-subtle" aria-label="Loading" />
            ) : has(m) ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-medium text-success">
                <Check size={12} aria-hidden /> Connected
              </span>
            ) : m === 'email' ? null : (
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void add(m)}
                className="rounded-lg border border-border px-3 py-1.5 text-[12px] font-medium text-muted transition-colors hover:bg-surface-2 hover:text-fg disabled:opacity-60"
              >
                {busy === m ? 'Opening…' : `Add ${LABEL[m]}`}
              </button>
            )}
          </span>
        </Row>
      ))}
      {error && (
        <p role="alert" className="px-4 pb-3 text-[12px] text-danger">
          {error}
        </p>
      )}
    </Group>
  )
}
