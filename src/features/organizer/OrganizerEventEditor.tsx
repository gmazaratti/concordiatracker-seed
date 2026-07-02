import { useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Bell, CalendarPlus, Check, Eye, Lock, RotateCcw, Trash2, UserPlus } from 'lucide-react'
import { useTeacher } from '@/app/providers/teacher'
import { eventToCommunity, type EventMetrics, type ManagedEvent } from '@/data/teacher'
import type { EventCategory, EventOrg } from '@/data/community'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { ImgbbHint } from '@/components/ui/InfoHint'
import { DateTimePicker } from '@/components/ui/DateTimePicker'
import { Segmented } from '@/features/settings/controls'
import { EventMedia } from '@/features/community/EventMedia'
import { CATEGORY_META, CATEGORY_ORDER } from '@/features/community/category'
import { cn } from '@/lib/cn'

const field =
  'w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-[13px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none'

/** Edit ONE of the organizer's own events. Resolves the event up front so the
 * form (with its hooks) only mounts when there's something to edit. */
export function OrganizerEventEditor() {
  const { eventId } = useParams()
  const { currentOrg } = useTeacher()
  if (!currentOrg) return <Navigate to="/organizer" replace />

  const event = currentOrg.events.find((e) => e.id === eventId)
  if (!event) return <NotFound />

  return (
    <EventEditorForm
      key={event.id}
      event={event}
      org={currentOrg.org}
      pending={currentOrg.status === 'pending'}
    />
  )
}

function EventEditorForm({
  event,
  org,
  pending,
}: {
  event: ManagedEvent
  org: EventOrg
  pending: boolean
}) {
  const { updateEvent, deleteEvent, notifyFollowers, isEventNotified, revertNotify } = useTeacher()
  const navigate = useNavigate()
  const notified = isEventNotified(event.id)

  const [title, setTitle] = useState(event.title)
  const [start, setStart] = useState(event.start)
  const [mode, setMode] = useState<ManagedEvent['mode']>(event.mode)
  const [location, setLocation] = useState(event.location)
  const [category, setCategory] = useState<EventCategory>(event.category)
  const [description, setDescription] = useState(event.description)
  const [image, setImage] = useState(event.image ?? '')
  const [relevant, setRelevant] = useState((event.relevantTo ?? []).join(', '))

  const [saved, setSaved] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  function touch() {
    setSaved(false)
  }

  function onDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    deleteEvent(event.id)
    navigate('/organizer/events')
  }

  function save() {
    updateEvent(event.id, {
      title: title.trim(),
      start,
      mode,
      location: location.trim(),
      category,
      description: description.trim(),
      image: image.trim() || undefined,
      relevantTo: relevant
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    })
    setSaved(true)
  }

  // Live preview of the public card (metrics dropped via eventToCommunity).
  const preview = eventToCommunity(
    { ...event, title: title.trim() || 'Untitled event', image: image.trim() || undefined },
    org,
  )

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-6 sm:px-6">
      <Link
        to="/organizer/events"
        className="mb-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-muted transition-colors duration-150 hover:text-fg"
      >
        <ArrowLeft size={15} aria-hidden />
        Events
      </Link>

      <h1 className="font-display text-[22px] leading-tight font-semibold text-fg">
        {title.trim() || 'Untitled event'}
      </h1>
      <p className="text-[13px] text-subtle">Edit the event students see in Community.</p>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[1fr_300px]">
        {/* Form */}
        <div className="flex flex-col gap-3.5">
          <Field label="Title">
            <input
              value={title}
              onChange={(e) => {
                setTitle(e.target.value)
                touch()
              }}
              placeholder="Event title"
              className={field}
            />
          </Field>

          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <Field label="Date & time">
              <DateTimePicker
                value={start}
                onChange={(iso) => {
                  setStart(iso)
                  touch()
                }}
                ariaLabel="Event date and time"
              />
            </Field>
            <Field label="Category">
              <Select
                ariaLabel="Category"
                value={category}
                onChange={(v) => {
                  setCategory(v as EventCategory)
                  touch()
                }}
                options={CATEGORY_ORDER.map((c) => ({ value: c, label: CATEGORY_META[c].label }))}
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <Field label="Format">
              <Segmented
                ariaLabel="Event format"
                value={mode}
                onChange={(v) => {
                  setMode(v)
                  touch()
                }}
                options={[
                  { value: 'in-person', label: 'In person' },
                  { value: 'online', label: 'Online' },
                ]}
              />
            </Field>
            <Field label={mode === 'online' ? 'Platform' : 'Location'}>
              <input
                value={location}
                onChange={(e) => {
                  setLocation(e.target.value)
                  touch()
                }}
                placeholder={mode === 'online' ? 'e.g. Zoom · Discord' : 'e.g. H 920'}
                className={field}
              />
            </Field>
          </div>

          <Field label="Description">
            <textarea
              value={description}
              onChange={(e) => {
                setDescription(e.target.value)
                touch()
              }}
              rows={4}
              placeholder="What's happening, who it's for, what to bring…"
              className={cn(field, 'resize-none')}
            />
          </Field>

          <Field
            label="Banner image URL"
            hint="Optional — your org supplies the art. Empty = branded fallback."
            info={<ImgbbHint />}
          >
            <input
              value={image}
              onChange={(e) => {
                setImage(e.target.value)
                touch()
              }}
              placeholder="https://…"
              className={field}
            />
          </Field>

          <Field label="Relevant programs" hint="Comma-separated — drives the opt-in “for your program” tag.">
            <input
              value={relevant}
              onChange={(e) => {
                setRelevant(e.target.value)
                touch()
              }}
              placeholder="e.g. Computer Science, Engineering"
              className={field}
            />
          </Field>

          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Button onClick={save} disabled={saved}>
              {saved ? (
                <>
                  <Check size={15} aria-hidden /> Saved
                </>
              ) : (
                'Save changes'
              )}
            </Button>
            {notified ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-success/40 bg-success/10 px-2.5 py-1.5 text-[12px] font-medium text-success">
                  <Check size={14} aria-hidden />
                  Followers notified
                </span>
                <Button variant="ghost" size="sm" onClick={() => revertNotify(event.id)}>
                  <RotateCcw size={14} aria-hidden />
                  Revert
                </Button>
              </span>
            ) : (
              <Button
                variant="outline"
                size="sm"
                disabled={pending}
                title={pending ? 'Available once your org is approved' : undefined}
                onClick={() => notifyFollowers(event.id)}
              >
                <Bell size={14} aria-hidden />
                Notify followers
              </Button>
            )}
            <button
              type="button"
              onClick={onDelete}
              className={cn(
                'ml-auto inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] font-medium transition-colors duration-150',
                confirmDelete
                  ? 'border-danger bg-danger/10 text-danger'
                  : 'border-border text-muted hover:bg-surface-2 hover:text-fg',
              )}
            >
              <Trash2 size={14} aria-hidden />
              {confirmDelete ? 'Click again to delete' : 'Delete'}
            </button>
          </div>
          {notified && (
            <p className="text-[12px] text-subtle">
              Followers were notified · delivery is stubbed in this build. Revert to send again.
            </p>
          )}
        </div>

        {/* Preview + metrics */}
        <aside className="flex flex-col gap-4">
          <div>
            <h2 className="mb-2 text-[11px] font-semibold tracking-wide text-subtle uppercase">
              Student preview
            </h2>
            <div className="overflow-hidden rounded-xl border border-border bg-surface">
              <EventMedia event={preview} variant="banner" />
              <div className="p-3">
                <p className="text-[13px] font-medium text-fg">{preview.title}</p>
                <p className="mt-0.5 text-[12px] text-subtle">
                  {org.name} · {location.trim() || (mode === 'online' ? 'Online' : 'Location TBA')}
                </p>
              </div>
            </div>
          </div>

          <Metrics metrics={event.metrics} />
        </aside>
      </div>
    </div>
  )
}

function Metrics({ metrics }: { metrics: EventMetrics }) {
  const rows = [
    { icon: CalendarPlus, label: 'Calendar adds', value: metrics.calendarAdds, primary: true },
    { icon: UserPlus, label: 'Follows', value: metrics.follows, primary: true },
    { icon: Eye, label: 'Views', value: metrics.views, primary: false },
  ]
  return (
    <div>
      <h2 className="mb-2 text-[11px] font-semibold tracking-wide text-subtle uppercase">
        This event's reach
      </h2>
      <ul className="flex flex-col gap-1.5 rounded-xl border border-border bg-surface p-3">
        {rows.map((r) => {
          const Icon = r.icon
          return (
            <li key={r.label} className="flex items-center justify-between text-[13px]">
              <span className="flex items-center gap-1.5 text-muted">
                <Icon size={14} className={r.primary ? 'text-accent' : 'text-subtle'} aria-hidden />
                {r.label}
              </span>
              <span className="font-medium text-fg tabular-nums">{r.value.toLocaleString()}</span>
            </li>
          )
        })}
      </ul>
      <p className="mt-2 flex items-start gap-1.5 text-[11px] text-subtle">
        <Lock size={12} className="mt-0.5 shrink-0" aria-hidden />
        Aggregate only — never which students.
      </p>
    </div>
  )
}

function Field({
  label,
  hint,
  info,
  children,
}: {
  label: string
  hint?: string
  info?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center gap-1 text-[12px] font-medium text-muted">
        {label}
        {info}
      </span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-subtle">{hint}</span>}
    </label>
  )
}

function NotFound() {
  return (
    <div className="mx-auto w-full max-w-md px-5 py-16 text-center">
      <h1 className="font-display text-[20px] font-semibold text-fg">Event not found</h1>
      <p className="mt-1.5 text-[13px] text-muted">It may have been deleted.</p>
      <Link
        to="/organizer/events"
        className="mt-4 inline-block rounded-lg border border-border px-4 py-2 text-[13px] font-medium text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
      >
        Back to events
      </Link>
    </div>
  )
}
