import { useCallback, useMemo } from 'react'
import { useUiState } from '@/app/providers/ui-state'
import type { Course } from '@/data/types'

/**
 * The order you dragged your classes into.
 *
 * Kept in `ui_state.courseOrder` rather than a column on `courses`: it needs no
 * migration, it is per-user by construction, and it follows you between devices
 * — which this one should, unlike a view toggle, because an arrangement is
 * something you BUILT rather than a property of the screen you are on.
 *
 * Stored as a list of ids, and reconciled on every read: ids that no longer
 * exist are ignored and courses the list has never seen fall to the end in
 * their natural order. So adding a course, deleting one, or arriving on a
 * second device all behave, and a stale order can never hide a class.
 */
export function useCourseOrder() {
  const { uiState, patchUiState } = useUiState()
  const order = useMemo(() => uiState.courseOrder ?? [], [uiState.courseOrder])

  const sort = useCallback(
    (list: Course[]): Course[] => {
      if (order.length === 0) return list
      const rank = new Map(order.map((id, i) => [id, i]))
      // A course with no saved position sorts after every course that has one,
      // rather than to the front — a new class should appear where you would
      // look for it, at the end, not shuffled into the middle of an order you
      // arranged on purpose.
      return [...list].sort(
        (a, b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity),
      )
    },
    [order],
  )

  /** Move `draggedId` to where `targetId` currently sits. */
  const move = useCallback(
    (visible: Course[], draggedId: string, targetId: string) => {
      if (draggedId === targetId) return
      const ids = visible.map((c) => c.id)
      const from = ids.indexOf(draggedId)
      const to = ids.indexOf(targetId)
      if (from < 0 || to < 0) return
      ids.splice(to, 0, ids.splice(from, 1)[0])
      // Only the ids on screen are re-sequenced; anything the current tab is
      // not showing keeps the position it had, so reordering this term cannot
      // scramble next term.
      const untouched = order.filter((id) => !ids.includes(id))
      patchUiState({ courseOrder: [...ids, ...untouched] })
    },
    [order, patchUiState],
  )

  return { sort, move, hasOrder: order.length > 0 }
}
