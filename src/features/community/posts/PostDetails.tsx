import { useEffect, useState } from 'react'
import {
  CalendarPlus,
  CalendarRange,
  ChevronRight,
  Clock,
  ExternalLink,
  Eye,
  EyeOff,
  Loader2,
  MapPin,
  Megaphone,
  Settings2,
  Users,
} from 'lucide-react'
import { ModalShell } from '@/command/ModalShell'
import { DateTimePicker } from '@/components/ui/DateTimePicker'
import { Switch } from '@/features/settings/controls'
import {
  createEventFromPost,
  listOrgEvents,
  readMapLink,
  type OrgEventOption,
  type PostDetailsValue,
} from '@/lib/post-details'
import { formatDueDateTime } from '@/lib/date'
import { cn } from '@/lib/cn'

/**
 * Everything about a post that is not its pictures or its words.
 *
 * ONE ROW PER DECISION, and each one says what it is currently set to — a list
 * of chevrons that all read "off" is a list nobody opens twice. The rows that
 * do nothing until you have made a choice open a sheet; the two that are a
 * single either/or are the choice itself.
 *
 * WHAT IS NOT HERE, on purpose:
 *   * No AI label. We do not make anybody's images, and a label we cannot
 *     verify is a claim the post makes on our behalf.
 *   * "Boost" is visible and disabled. Hiding an unbuilt feature is tidier;
 *     showing it as SOON is honest about the shape of the product, which is
 *     what the club is deciding against.
 */
export function PostDetails({
  orgId,
  caption,
  value,
  onChange,
  onError,
}: {
  orgId: string
  /** Seeds an event's name — the caption is usually the announcement. */
  caption: string
  value: PostDetailsValue
  onChange: (patch: Partial<PostDetailsValue>) => void
  onError: (message: string) => void
}) {
  const [sheet, setSheet] = useState<null | 'event' | 'create' | 'place' | 'more'>(null)
  const [events, setEvents] = useState<OrgEventOption[] | null>(null)

  useEffect(() => {
    if (sheet !== 'event') return
    let alive = true
    void listOrgEvents(orgId).then((rows) => alive && setEvents(rows))
    return () => {
      alive = false
    }
  }, [sheet, orgId])

  const linked = events?.find((e) => e.id === value.eventId)
  const placeLabel = value.place || (value.placeUrl ? readMapLink(value.placeUrl).host : '')
  const extras =
    (value.publishAt ? 1 : 0) + (value.hideLikes ? 1 : 0) + (value.hideShares ? 1 : 0)

  return (
    <div className="mt-3 divide-y divide-border/70 border-y border-border/70">
      <Row
        icon={CalendarRange}
        label="Link an event"
        value={linked ? linked.title : value.eventId ? 'Linked' : undefined}
        onClick={() => setSheet('event')}
      />
      <Row icon={MapPin} label="Add location" value={placeLabel} onClick={() => setSheet('place')} />

      {/* AUDIENCE IS THE CHOICE, not a door to it. Two options do not deserve
          a screen, and it is the one row where the answer changes who can read
          the post at all — worth being legible without a tap. */}
      <div className="flex items-center gap-3 py-3">
        <Users size={18} className="shrink-0 text-subtle" aria-hidden />
        <span className="flex-1 text-[13.5px] text-fg">Audience</span>
        <div className="flex rounded-full bg-surface-2 p-0.5">
          {(['everyone', 'followers'] as const).map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => onChange({ audience: a })}
              aria-pressed={value.audience === a}
              className={cn(
                'rounded-full px-2.5 py-1 text-[12px] font-medium transition-colors duration-150',
                value.audience === a ? 'bg-accent text-accent-contrast' : 'text-muted hover:text-fg',
              )}
            >
              {a === 'everyone' ? 'Everyone' : 'Followers'}
            </button>
          ))}
        </div>
      </div>

      <Row
        icon={CalendarPlus}
        label="Share to Events"
        hint="Make an event out of this post"
        onClick={() => setSheet('create')}
      />
      <Row
        icon={Settings2}
        label="More options"
        value={extras > 0 ? `${extras} set` : undefined}
        onClick={() => setSheet('more')}
      />

      {sheet === 'event' && (
        <ModalShell label="Link an event" onClose={() => setSheet(null)} widthClass="sm:max-w-sm">
          <div className="px-4 pt-4 pb-3">
            <h2 className="text-[15px] font-semibold text-fg">Link an event</h2>
            <p className="mt-0.5 text-[12.5px] text-subtle">
              Point this post at an event you have already published. Nothing new is created.
            </p>
            {events === null ? (
              <p className="py-6 text-center text-[12.5px] text-subtle">Loading…</p>
            ) : events.length === 0 ? (
              <p className="py-6 text-center text-[12.5px] text-subtle">
                This club has no events yet.
              </p>
            ) : (
              <ul className="mt-2 max-h-[46vh] overflow-y-auto">
                {events.map((e) => (
                  <li key={e.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onChange({ eventId: value.eventId === e.id ? null : e.id })
                        setSheet(null)
                      }}
                      className="flex w-full items-center gap-3 rounded-xl px-1 py-2.5 text-left transition-colors duration-150 hover:bg-surface-2"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-medium text-fg">
                          {e.title}
                        </span>
                        <span className="block truncate text-[12px] text-subtle">
                          {formatDueDateTime(e.start)}
                        </span>
                      </span>
                      {value.eventId === e.id && (
                        <span className="shrink-0 text-[11.5px] font-medium text-accent">
                          Linked
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              onClick={() => setSheet('create')}
              className="mt-2 flex w-full items-center gap-2 rounded-xl border border-dashed border-border px-3 py-2.5 text-[13px] font-medium text-accent"
            >
              <CalendarPlus size={15} aria-hidden />
              Create one from this post
            </button>
          </div>
        </ModalShell>
      )}

      {sheet === 'create' && (
        <CreateEventSheet
          orgId={orgId}
          caption={caption}
          place={value.place}
          onClose={() => setSheet(null)}
          onCreated={(id) => {
            onChange({ eventId: id })
            setSheet(null)
          }}
          onError={onError}
        />
      )}

      {sheet === 'place' && (
        <ModalShell label="Add location" onClose={() => setSheet(null)} widthClass="sm:max-w-sm">
          <div className="px-4 pt-4 pb-4">
            <h2 className="text-[15px] font-semibold text-fg">Add location</h2>
            <label className="mt-3 block text-[12px] font-medium text-subtle">Place</label>
            <input
              value={value.place}
              onChange={(e) => onChange({ place: e.target.value })}
              maxLength={80}
              placeholder="H 920, or the atrium"
              className="mt-1 w-full rounded-lg border border-border bg-canvas px-3 py-2 text-[13.5px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none"
            />
            <label className="mt-3 block text-[12px] font-medium text-subtle">
              Map link (optional)
            </label>
            <input
              value={value.placeUrl}
              onChange={(e) => onChange({ placeUrl: e.target.value })}
              inputMode="url"
              placeholder="https://maps.app.goo.gl/…"
              className="mt-1 w-full rounded-lg border border-border bg-canvas px-3 py-2 text-[13.5px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none"
            />
            <MapHint url={value.placeUrl} />
            <button
              type="button"
              onClick={() => setSheet(null)}
              className="mt-4 w-full rounded-full bg-accent py-2.5 text-[13.5px] font-semibold text-accent-contrast"
            >
              Done
            </button>
          </div>
        </ModalShell>
      )}

      {sheet === 'more' && (
        <ModalShell label="More options" onClose={() => setSheet(null)} widthClass="sm:max-w-sm">
          <div className="px-4 pt-4 pb-4">
            <h2 className="text-[15px] font-semibold text-fg">More options</h2>

            <div className="mt-3 flex items-start gap-3">
              <Clock size={17} className="mt-0.5 shrink-0 text-subtle" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] text-fg">Schedule post</p>
                <p className="text-[12px] text-subtle">
                  It stays off the feed — including yours — until then.
                </p>
                <div className="mt-2">
                  <DateTimePicker
                    value={value.publishAt}
                    onChange={(iso) => onChange({ publishAt: iso })}
                    ariaLabel="Publish at"
                    clearable
                  />
                </div>
                {value.publishAt && (
                  <button
                    type="button"
                    onClick={() => onChange({ publishAt: null })}
                    className="mt-1.5 text-[12px] font-medium text-accent"
                  >
                    Post immediately instead
                  </button>
                )}
              </div>
            </div>

            {/* VISIBLE AND DEAD, deliberately. It is not built, and a row that
                quietly does nothing is worse than one that says why. */}
            <div className="mt-4 flex items-center gap-3 opacity-60">
              <Megaphone size={17} className="shrink-0 text-subtle" aria-hidden />
              <span className="flex-1 text-[13.5px] text-fg">Boost post</span>
              <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-subtle uppercase">
                Soon
              </span>
            </div>

            <div className="mt-4 space-y-3 border-t border-border pt-3">
              <CountSwitch
                icon={value.hideLikes ? EyeOff : Eye}
                label="Hide like count"
                hint="You can still see it."
                on={value.hideLikes}
                onChange={(on) => onChange({ hideLikes: on })}
              />
              <CountSwitch
                icon={value.hideShares ? EyeOff : Eye}
                label="Hide share count"
                hint="You can still see it."
                on={value.hideShares}
                onChange={(on) => onChange({ hideShares: on })}
              />
            </div>

            <button
              type="button"
              onClick={() => setSheet(null)}
              className="mt-5 w-full rounded-full bg-accent py-2.5 text-[13.5px] font-semibold text-accent-contrast"
            >
              Done
            </button>
          </div>
        </ModalShell>
      )}
    </div>
  )
}

function Row({
  icon: Icon,
  label,
  value,
  hint,
  onClick,
}: {
  icon: typeof MapPin
  label: string
  value?: string
  hint?: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="-mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-xl px-2 py-3 text-left transition-colors duration-150 hover:bg-surface-2/60 active:bg-surface-2 focus-visible:outline-2 focus-visible:outline-accent"
    >
      <Icon size={18} className="shrink-0 text-subtle" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block text-[13.5px] text-fg">{label}</span>
        {hint && !value && <span className="block text-[11.5px] text-subtle">{hint}</span>}
      </span>
      {value && (
        <span className="max-w-[45%] truncate text-[12.5px] text-subtle">{value}</span>
      )}
      <ChevronRight size={16} className="shrink-0 text-subtle" aria-hidden />
    </button>
  )
}

function CountSwitch({
  icon: Icon,
  label,
  hint,
  on,
  onChange,
}: {
  icon: typeof Eye
  label: string
  hint: string
  on: boolean
  onChange: (on: boolean) => void
}) {
  return (
    <div className="flex items-center gap-3">
      <Icon size={17} className="shrink-0 text-subtle" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block text-[13.5px] text-fg">{label}</span>
        <span className="block text-[11.5px] text-subtle">{hint}</span>
      </span>
      <Switch checked={on} onChange={onChange} label={label} />
    </div>
  )
}

/** Says where the link goes before anybody taps it. */
function MapHint({ url }: { url: string }) {
  if (!url.trim()) return null
  const link = readMapLink(url)
  if (!link.ok) {
    return (
      <p className="mt-1.5 text-[11.5px] text-warning">
        That is not a web address. A map link starts with https://
      </p>
    )
  }
  return (
    <p className="mt-1.5 flex items-center gap-1 text-[11.5px] text-subtle">
      <ExternalLink size={11} aria-hidden />
      Opens {link.host}
      {!link.isMap && ' — not a map we recognise, but it will still open'}
    </p>
  )
}

function CreateEventSheet({
  orgId,
  caption,
  place,
  onClose,
  onCreated,
  onError,
}: {
  orgId: string
  caption: string
  place: string
  onClose: () => void
  onCreated: (id: string) => void
  onError: (message: string) => void
}) {
  // The caption's FIRST LINE, not the whole thing: a title is read in a list.
  const [title, setTitle] = useState(() => caption.split('\n')[0]?.slice(0, 80) ?? '')
  const [start, setStart] = useState<string>('')
  const [where, setWhere] = useState(place)
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (busy) return
    setBusy(true)
    const made = await createEventFromPost({
      orgId,
      title,
      start,
      location: where,
      description: caption,
    })
    setBusy(false)
    if ('error' in made) {
      onError(made.error)
      return
    }
    onCreated(made.id)
  }

  return (
    <ModalShell label="Create an event" onClose={onClose} widthClass="sm:max-w-sm">
      <div className="px-4 pt-4 pb-4">
        <h2 className="text-[15px] font-semibold text-fg">Create an event</h2>
        <p className="mt-0.5 text-[12.5px] text-subtle">
          It goes on the Events tab as its own thing, and this post links to it.
        </p>

        <label className="mt-3 block text-[12px] font-medium text-subtle">Name</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={80}
          placeholder="Karaoke night"
          className="mt-1 w-full rounded-lg border border-border bg-canvas px-3 py-2 text-[13.5px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none"
        />

        <label className="mt-3 block text-[12px] font-medium text-subtle">When</label>
        <div className="mt-1">
          <DateTimePicker value={start} onChange={(iso) => setStart(iso ?? '')} ariaLabel="Event date" />
        </div>

        <label className="mt-3 block text-[12px] font-medium text-subtle">Where</label>
        <input
          value={where}
          onChange={(e) => setWhere(e.target.value)}
          maxLength={80}
          placeholder="Reggie's — leave empty for online"
          className="mt-1 w-full rounded-lg border border-border bg-canvas px-3 py-2 text-[13.5px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none"
        />

        <button
          type="button"
          onClick={() => void submit()}
          disabled={busy || !title.trim() || !start}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent py-2.5 text-[13.5px] font-semibold text-accent-contrast disabled:opacity-60"
        >
          {busy && <Loader2 size={14} className="animate-spin" aria-hidden />}
          Create event
        </button>
      </div>
    </ModalShell>
  )
}
