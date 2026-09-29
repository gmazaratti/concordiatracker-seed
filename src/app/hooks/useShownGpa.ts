import { useCallback, useSyncExternalStore } from 'react'
import { useIsAdmin } from '@/features/admin/admin-data'
import { demoGpa, demoGpaSnapshot, subscribeDemoGpa } from '@/lib/demo-gpa'

/**
 * The GPA as it should be SHOWN to the person looking at it.
 *
 * For everyone but an admin with "Flatter my GPA" on, this is the identity
 * function. It used to be applied in exactly one place (Planner → My record),
 * so the headline figures on Today, Courses and Past semesters kept showing the
 * real number and the switch looked broken. Every self-facing headline GPA now
 * goes through here, so they cannot disagree with each other.
 *
 * STILL SCREEN-ONLY, per lib/demo-gpa.ts: nothing that is exported, shared,
 * sent to someone else or stored passes through this. A record you send a
 * classmate carries the true figure.
 */
export function useShownGpa(): (gpa: number | null) => number | null {
  const { isAdmin } = useIsAdmin()
  const on = useSyncExternalStore(subscribeDemoGpa, demoGpaSnapshot, demoGpaSnapshot)
  return useCallback((gpa: number | null) => (isAdmin ? demoGpa(gpa, on) : gpa), [isAdmin, on])
}
