import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CalendarX2, Sparkles } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { ModalShell } from '@/command/ModalShell'
import { EventDetailView } from './EventDetail'
import { ShareEventModal } from './ShareEventModal'
import { useCommunity } from './useCommunity'

/**
 * Public, shareable event page (`/e/:id`) — viewable by ANYONE, no account
 * needed (this is what a shared link opens). It reuses `EventDetailView` in
 * gated mode: any interaction (add / remind / follow / contact) prompts signup;
 * viewing and sharing stay open. Lives outside the student app shell.
 */
export function PublicEventPage() {
  const { eventId } = useParams()
  const navigate = useNavigate()
  const { eventById } = useCommunity()
  const [shareOpen, setShareOpen] = useState(false)
  const [gateOpen, setGateOpen] = useState(false)

  const event = eventId ? eventById(eventId) : undefined

  // Scroll to top when navigating between events ("more from this host").
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [eventId])

  return (
    <div className="min-h-svh bg-canvas">
      <header className="sticky top-0 z-10 border-b border-border bg-canvas/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3 px-5 py-3">
          <Link to="/" aria-label="ConcordiaTracker home">
            <Logo />
          </Link>
          <Link
            to="/app"
            className="rounded-lg bg-accent px-3 py-1.5 text-[13px] font-medium text-accent-contrast transition-colors duration-150 hover:bg-accent-hover"
          >
            Sign up free
          </Link>
        </div>
      </header>

      {event ? (
        <>
          <EventDetailView
            event={event}
            added={false}
            onAdd={() => setGateOpen(true)}
            onOpenEvent={(id) => navigate(`/e/${id}`)}
            onShare={() => setShareOpen(true)}
            gate={() => setGateOpen(true)}
          />
          {shareOpen && <ShareEventModal event={event} onClose={() => setShareOpen(false)} />}
        </>
      ) : (
        <NotFound />
      )}

      {gateOpen && <SignupGate onClose={() => setGateOpen(false)} />}
    </div>
  )
}

/** The signup prompt shown when a logged-out viewer tries to interact. */
function SignupGate({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  return (
    <ModalShell label="Create an account" onClose={onClose}>
      <div className="p-6 text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-accent-soft text-accent">
          <Sparkles size={24} aria-hidden />
        </span>
        <h2 className="mt-3 font-display text-[20px] font-semibold text-fg">Create a free account</h2>
        <p className="mx-auto mt-1.5 max-w-xs text-[13px] leading-relaxed text-muted">
          Sign up to add events to your calendar, follow orgs, and get reminders. Viewing is always
          free.
        </p>
        <button
          type="button"
          onClick={() => navigate('/app')}
          className="mt-4 w-full rounded-lg bg-accent px-4 py-2.5 text-[14px] font-medium text-accent-contrast transition-colors duration-150 hover:bg-accent-hover"
        >
          Sign up free
        </button>
        <button
          type="button"
          onClick={onClose}
          className="mt-2 w-full rounded-lg border border-border px-4 py-2.5 text-[13px] font-medium text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
        >
          Maybe later
        </button>
        <p className="mt-3 text-[12px] text-subtle">
          Already a member?{' '}
          <Link to="/app" className="font-medium text-accent hover:underline">
            Open the app
          </Link>
        </p>
      </div>
    </ModalShell>
  )
}

function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center px-5 py-24 text-center">
      <span className="grid size-12 place-items-center rounded-2xl bg-surface-2 text-subtle">
        <CalendarX2 size={24} aria-hidden />
      </span>
      <h1 className="mt-3 font-display text-[22px] font-semibold text-fg">Event not found</h1>
      <p className="mt-1.5 text-[14px] text-muted">
        This event link is invalid or the event is no longer listed.
      </p>
      <Link
        to="/app/community"
        className="mt-5 rounded-lg bg-accent px-4 py-2.5 text-[14px] font-medium text-accent-contrast transition-colors duration-150 hover:bg-accent-hover"
      >
        Browse events
      </Link>
    </div>
  )
}
