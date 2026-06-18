import { useSearchParams } from 'react-router-dom'
import { useAppData } from '@/app/providers/app-data'
import type { CampusEvent } from '@/data/community'
import { useCommunity } from './useCommunity'

/** Shared event interactions for the feed AND the org profile page: whether an
 * event is already on your calendar (derived from `personalTasks`, so "Added"
 * stays consistent across surfaces), adding it, and the `?event=` detail-overlay
 * open/close (preserving any other query params, e.g. the org route). */
export function useEventActions() {
  const { addTask, personalTasks } = useAppData()
  const { eventById } = useCommunity()
  const [params, setParams] = useSearchParams()

  const isAdded = (e: CampusEvent) =>
    personalTasks.some((t) => t.title === e.title && t.due === e.start)

  const add = (e: CampusEvent) =>
    addTask({ title: e.title, due: e.start, note: `${e.org.name} · ${e.location}` })

  const openEvent = (id: string) =>
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev)
        p.set('event', id)
        return p
      },
      { replace: false },
    )

  const closeEvent = () =>
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev)
        p.delete('event')
        return p
      },
      { replace: false },
    )

  const selectedId = params.get('event')
  const selectedEvent = selectedId ? eventById(selectedId) : undefined

  return { isAdded, add, openEvent, closeEvent, selectedEvent }
}
