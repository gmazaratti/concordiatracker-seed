import { useEffect, useState } from 'react'
import { useAuth } from '@/app/providers/auth'
import { myGuardedStudents } from '@/lib/guardians'

/** Remembered per account for the session: the menu should not re-ask on every open. */
const known = new Map<string, boolean>()

/** True when someone has shared their courses with this account (family access). */
export function useIsGuardian(): boolean {
  const { user } = useAuth()
  const uid = user?.id ?? ''
  const [is, setIs] = useState(() => known.get(uid) ?? false)
  useEffect(() => {
    if (!uid || known.has(uid)) return
    let alive = true
    void myGuardedStudents().then((s) => {
      known.set(uid, s.length > 0)
      if (alive) setIs(s.length > 0)
    })
    return () => {
      alive = false
    }
  }, [uid])
  return uid ? (known.get(uid) ?? is) : false
}
