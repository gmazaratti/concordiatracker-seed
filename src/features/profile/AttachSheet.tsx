import { useMemo, useState } from 'react'
import {
  BookOpen,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  PartyPopper,
  Search,
  type LucideIcon,
} from 'lucide-react'
import { ModalShell } from '@/command/ModalShell'
import type { Attachment, SharedClass } from '@/lib/social'
import type { RecordSnapshot } from '@/lib/record-export'
import { cn } from '@/lib/cn'

/**
 * Everything you can send.
 *
 * FOUR CHOICES FIRST, NOT FORTY. The first version poured every class, every
 * saved schedule and every upcoming event into one scroll the moment it
 * opened — so the answer to "what can I send?" was a wall you had to read
 * before you could see the shape of it. You know whether you want a class or
 * an event before you know which one; the category is the fast question and
 * the item is the slow one, so they are two steps.
 *
 * THE SEARCH SPANS ALL OF THEM and skips the step entirely, because somebody
 * who already knows they want COMM 305 should not have to remember whether
 * that counts as "a class".
 *
 * `record` is a category with exactly one thing in it, so it is picked
 * directly from the first screen rather than opening a list of one.
 */
export interface AttachSource {
  classes: { id: string; code: string; title: string; color?: string; credits?: number }[]
  schedules: { id: string; name: string; classes: SharedClass[] }[]
  events: { id: string; title: string; org: string }[]
  record: RecordSnapshot | null
}

type Group = 'schedule' | 'class' | 'event'

interface Item {
  key: string
  group: Group
  icon: LucideIcon
  label: string
  hint?: string
  attachment: Attachment
}

export function AttachSheet({
  source,
  onPick,
  onClose,
}: {
  source: AttachSource
  onPick: (a: Attachment) => void
  onClose: () => void
}) {
  const [group, setGroup] = useState<Group | null>(null)
  const [q, setQ] = useState('')

  const items = useMemo<Item[]>(
    () => [
      ...source.schedules.map((s) => ({
        key: `schedule:${s.id}`,
        group: 'schedule' as const,
        icon: CalendarRange,
        label: s.name,
        hint: `${s.classes.length} ${s.classes.length === 1 ? 'class' : 'classes'}`,
        attachment: {
          kind: 'schedule' as const,
          id: s.id,
          name: s.name,
          classes: s.classes,
          sentAt: new Date().toISOString(),
        },
      })),
      ...source.classes.map((c) => ({
        key: `class:${c.id}`,
        group: 'class' as const,
        icon: BookOpen,
        label: c.code || 'Course',
        hint: c.title,
        attachment: {
          kind: 'course' as const,
          code: c.code,
          title: c.title,
          color: c.color,
          credits: c.credits,
        },
      })),
      ...source.events.map((e) => ({
        key: `event:${e.id}`,
        group: 'event' as const,
        icon: PartyPopper,
        label: e.title,
        hint: e.org,
        attachment: { kind: 'event' as const, id: e.id, title: e.title },
      })),
    ],
    [source],
  )

  const term = q.trim().toLowerCase()
  const results = term
    ? items.filter(
        (i) =>
          i.label.toLowerCase().includes(term) || (i.hint ?? '').toLowerCase().includes(term),
      )
    : group
      ? items.filter((i) => i.group === group)
      : []

  const send = (a: Attachment) => {
    onPick(a)
    onClose()
  }

  const count = (g: Group) => items.filter((i) => i.group === g).length
  const GROUPS: { id: Group; icon: LucideIcon; label: string }[] = [
    { id: 'schedule', icon: CalendarRange, label: 'Your schedule' },
    { id: 'class', icon: BookOpen, label: 'A class' },
    { id: 'event', icon: PartyPopper, label: 'An event' },
  ]

  const title = group
    ? (GROUPS.find((g) => g.id === group)?.label ?? 'Send something')
    : 'Send something'

  return (
    <ModalShell label="Send something" onClose={onClose} widthClass="sm:max-w-md">
      <div className="px-3 pt-2 pb-4">
        <div className="flex items-center gap-1 px-1 pb-2">
          {group && !term && (
            <button
              type="button"
              onClick={() => setGroup(null)}
              aria-label="Back"
              className="-ml-1 grid size-7 shrink-0 place-items-center rounded-full text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
            >
              <ChevronLeft size={18} aria-hidden />
            </button>
          )}
          <h2 className="min-w-0 flex-1 truncate text-[15px] font-semibold text-fg">{title}</h2>
        </div>

        <div className="relative mb-2 px-1">
          <Search
            size={15}
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-subtle"
          />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search classes, events, schedules"
            aria-label="Search everything you can send"
            className="w-full rounded-xl border border-transparent bg-surface-2 py-2.5 pr-3 pl-9 text-[14px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none"
          />
        </div>

        {/* The four answers to "what kind of thing?" — shown until you pick
            one, and skipped entirely the moment you type. */}
        {!group && !term && (
          <ul>
            {GROUPS.map((g) => {
              const n = count(g.id)
              return (
                <li key={g.id}>
                  <Row
                    icon={g.icon}
                    label={g.label}
                    hint={n === 0 ? 'Nothing here yet' : `${n} ${n === 1 ? 'option' : 'options'}`}
                    disabled={n === 0}
                    chevron
                    onPick={() => setGroup(g.id)}
                  />
                </li>
              )
            })}
            {/* One thing, so it sends from here rather than opening a list of one. */}
            {source.record && source.record.courseCount > 0 && (
              <li>
                <Row
                  icon={GraduationCap}
                  label="Your record"
                  hint={`${source.record.credits} credits${
                    source.record.gpa === null ? '' : ` · GPA ${source.record.gpa.toFixed(2)}`
                  }`}
                  onPick={() => send({ kind: 'record', snapshot: source.record! })}
                />
              </li>
            )}
          </ul>
        )}

        {(group || term) && (
          <ul className="max-h-[52vh] overflow-y-auto">
            {results.length === 0 ? (
              <li className="px-2 py-8 text-center text-[13px] text-subtle">
                {term ? `Nothing matching “${q.trim()}”.` : 'Nothing here yet.'}
              </li>
            ) : (
              results.map((i) => (
                <li key={i.key}>
                  <Row
                    icon={i.icon}
                    label={i.label}
                    hint={i.hint}
                    onPick={() => send(i.attachment)}
                  />
                </li>
              ))
            )}
          </ul>
        )}
      </div>
    </ModalShell>
  )
}

function Row({
  icon: Icon,
  label,
  hint,
  chevron,
  disabled,
  onPick,
}: {
  icon: LucideIcon
  label: string
  hint?: string
  chevron?: boolean
  disabled?: boolean
  onPick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      disabled={disabled}
      className={cn(
        'flex w-full items-center gap-3 rounded-xl px-1 py-2.5 text-left transition-colors duration-150',
        disabled ? 'opacity-40' : 'hover:bg-surface-2',
      )}
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-accent">
        <Icon size={18} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-medium text-fg">{label}</span>
        {hint && <span className="block truncate text-[12px] text-subtle">{hint}</span>}
      </span>
      {chevron && <ChevronRight size={16} className="shrink-0 text-subtle" aria-hidden />}
    </button>
  )
}
