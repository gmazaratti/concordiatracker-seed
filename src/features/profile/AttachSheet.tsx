import { BookOpen, CalendarRange, GraduationCap, PartyPopper, type LucideIcon } from 'lucide-react'
import { ModalShell } from '@/command/ModalShell'
import type { Attachment, SharedClass } from '@/lib/social'
import type { RecordSnapshot } from '@/lib/record-export'

/**
 * Everything you can send, as a sheet rather than a popover.
 *
 * WHY IT STOPPED BEING A DROPDOWN. It was 248px wide and 320px tall, anchored
 * to a 36px button in the corner of the screen — four groups of rows crammed
 * into a box smaller than a business card, on the surface where a student is
 * most likely to be one-handed. You could not scan it, which is the only job
 * a picker has.
 *
 * A sheet is the same list with room to read: full width on a phone, a
 * centred dialog on a desktop, and `ModalShell` already brings the grabber,
 * swipe-to-dismiss, the focus trap and Escape. Nothing here needed inventing.
 *
 * THE ROWS ARE 56px AND CARRY A HINT, because the thing that makes this hard
 * is not finding "a class" — it is finding WHICH class, and the hint is the
 * course title that tells you.
 */
export function AttachSheet({
  classes,
  schedules,
  events,
  record,
  onPick,
  onClose,
}: {
  classes: { id: string; code: string; title: string; color?: string; credits?: number }[]
  schedules: { id: string; name: string; classes: SharedClass[] }[]
  events: { id: string; title: string; org: string }[]
  record: RecordSnapshot | null
  onPick: (a: Attachment) => void
  onClose: () => void
}) {
  const send = (a: Attachment) => {
    onPick(a)
    onClose()
  }

  return (
    <ModalShell label="Send something" onClose={onClose} widthClass="sm:max-w-md">
      <div className="px-3 pt-2 pb-4">
        <h2 className="px-1 pb-1 text-[15px] font-semibold text-fg">Send something</h2>
        <p className="px-1 pb-3 text-[12.5px] text-subtle">
          They open the live thing, not a screenshot.
        </p>

        <Group label="Your schedule">
          {schedules.map((s) => (
            <Row
              key={s.id}
              icon={CalendarRange}
              label={s.name}
              hint={`${s.classes.length} ${s.classes.length === 1 ? 'class' : 'classes'}`}
              onPick={() =>
                send({
                  kind: 'schedule',
                  id: s.id,
                  name: s.name,
                  classes: s.classes,
                  sentAt: new Date().toISOString(),
                })
              }
            />
          ))}
        </Group>

        {record && record.courseCount > 0 && (
          <Group label="Your record">
            <Row
              icon={GraduationCap}
              label="My record"
              hint={`${record.credits} credits${record.gpa === null ? '' : ` · GPA ${record.gpa.toFixed(2)}`}`}
              onPick={() => send({ kind: 'record', snapshot: record })}
            />
          </Group>
        )}

        {classes.length > 0 && (
          <Group label="A class">
            {classes.map((c) => (
              <Row
                key={c.id}
                icon={BookOpen}
                label={c.code || 'Course'}
                hint={c.title}
                onPick={() =>
                  send({
                    kind: 'course',
                    code: c.code,
                    title: c.title,
                    color: c.color,
                    credits: c.credits,
                  })
                }
              />
            ))}
          </Group>
        )}

        {events.length > 0 && (
          <Group label="An event">
            {events.map((e) => (
              <Row
                key={e.id}
                icon={PartyPopper}
                label={e.title}
                hint={e.org}
                onPick={() => send({ kind: 'event', id: e.id, title: e.title })}
              />
            ))}
          </Group>
        )}
      </div>
    </ModalShell>
  )
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="mb-1">
      <h3 className="px-1 pt-2 pb-1 text-[11px] font-semibold tracking-wide text-subtle uppercase">
        {label}
      </h3>
      {children}
    </section>
  )
}

function Row({
  icon: Icon,
  label,
  hint,
  onPick,
}: {
  icon: LucideIcon
  label: string
  hint?: string
  onPick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      className="flex w-full items-center gap-3 rounded-xl px-1 py-2 text-left transition-colors duration-150 hover:bg-surface-2"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-accent">
        <Icon size={18} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-medium text-fg">{label}</span>
        {hint && <span className="block truncate text-[12px] text-subtle">{hint}</span>}
      </span>
    </button>
  )
}
