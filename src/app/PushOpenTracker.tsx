import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/app/providers/auth'
import { supabase } from '@/lib/supabase'

/**
 * A push sent from the admin panel carries `?pn=<log id>` on its link. When
 * that link brings someone in, mark the push opened (db/push_log.sql) and take
 * the param off the address so a reload or a shared link does not count twice.
 *
 * Waits for a session: mark_push_opened only marks the caller's own row, so a
 * signed-out open is kept in the address until sign-in finishes.
 */
export function PushOpenTracker() {
  const { user } = useAuth()
  const { pathname, search, hash } = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    if (!user) return
    const params = new URLSearchParams(search)
    const id = params.get('pn')
    if (!id) return
    params.delete('pn')
    if (/^[0-9a-f-]{36}$/i.test(id)) void supabase.rpc('mark_push_opened', { p_id: id }).then(() => undefined)
    const rest = params.toString()
    navigate(`${pathname}${rest ? `?${rest}` : ''}${hash}`, { replace: true })
  }, [user, pathname, search, hash, navigate])

  return null
}
