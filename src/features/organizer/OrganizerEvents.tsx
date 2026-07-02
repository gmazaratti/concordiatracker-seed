import { Navigate, useNavigate } from 'react-router-dom'
import { useTeacher } from '@/app/providers/teacher'
import { OrgEventsTab } from './OrgEventsTab'

/** `/organizer/events` — the full event manager: grid/list toggle, Upcoming +
 * Past sections, and create. */
export function OrganizerEvents() {
  const { currentOrg, createEvent } = useTeacher()
  const navigate = useNavigate()
  if (!currentOrg) return <Navigate to="/organizer" replace />

  function newEvent() {
    const id = createEvent()
    navigate(`/organizer/event/${id}`)
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-6 sm:px-6">
      <header className="mb-5">
        <h1 className="font-display text-[24px] leading-tight font-semibold text-fg">Events</h1>
        <p className="text-[13px] text-subtle">
          Everything you've posted — upcoming and past. Click any event to edit it.
        </p>
      </header>
      <OrgEventsTab events={currentOrg.events} orgColor={currentOrg.org.color} onNew={newEvent} />
    </div>
  )
}
