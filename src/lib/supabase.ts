import { createClient } from '@supabase/supabase-js'
import { reportWriteError, writeErrorText } from './write-errors'

/**
 * The single Supabase client for the app. Reads the project URL + public anon
 * key from `.env.local` (dev → the sandbox project). Auth options mirror the
 * old production site: sessions persist in localStorage, tokens auto-refresh,
 * and an OAuth redirect (Google) is detected from the URL on return.
 */
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

if (!url || !anonKey) {
  // Surfaced clearly so a missing/!restarted .env.local is obvious in dev.
  console.error(
    'Supabase env vars missing. Check .env.local has VITE_SUPABASE_URL + ' +
      'VITE_SUPABASE_ANON_KEY, then restart the dev server.',
  )
}

/**
 * Dev servers only: `localStorage.ct_force_offline = '1'` makes every database
 * call fail the way airplane mode does, to exercise the offline screens
 * (lib/offline-cache). `import.meta.env.DEV` is false in every production
 * bundle, so no real user can switch this on.
 */
function devOfflineFetch(): typeof fetch | undefined {
  try {
    if (!import.meta.env.DEV || localStorage.getItem('ct_force_offline') !== '1') return undefined
  } catch {
    return undefined
  }
  return () => Promise.reject(new TypeError('Failed to fetch'))
}

const offlineFetch = devOfflineFetch()

export const supabase = createClient(url ?? '', anonKey ?? '', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  ...(offlineFetch ? { global: { fetch: offlineFetch } } : {}),
})

/**
 * Execute a fire-and-forget Supabase write. PostgREST query builders are LAZY —
 * they only send the request when awaited or `.then()`-ed. A bare `void builder`
 * never runs.
 *
 * A FAILURE REACHES THE USER, it does not only reach the console. This used to
 * `console.error` and carry on, which is how every `org_activity` insert could
 * be refused by RLS for a day while the screen kept saying the save had worked.
 * A save that silently did not happen is worse than an error, because the
 * person walks away believing it.
 */
export function fireWrite(
  query: PromiseLike<{ error: unknown } | unknown>,
  /** What was being attempted, in the user's words. Shown if it fails. */
  what = 'Something did not save',
) {
  Promise.resolve(query)
    .then((res) => {
      const err = (res as { error?: unknown } | null)?.error
      if (err) {
        console.error('Supabase write failed:', err)
        reportWriteError(what, writeErrorText(err))
      }
    })
    .catch((e) => {
      console.error('Supabase write error:', e)
      reportWriteError(what, writeErrorText(e))
    })
}
