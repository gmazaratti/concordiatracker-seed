import { Link } from 'react-router-dom'
import { Hash } from 'lucide-react'
import { splitMentions } from '@/lib/mentions'
import { mentionLabel, type MentionOption } from './mention-options'
import { initialsOf } from '@/lib/initials'
import { cn } from '@/lib/cn'

/** A message body with its @mentions linked: people to their profile, @Planner and friends to that screen. */
export function MentionText({ body, mine }: { body: string; mine: boolean }) {
  const parts = splitMentions(body)
  return (
    <>
      {parts.map((p, i) =>
        'text' in p ? (
          <span key={i}>{p.text}</span>
        ) : (
          <Link
            key={i}
            to={p.href}
            onClick={(e) => e.stopPropagation()}
            className={cn('font-semibold hover:underline', mine ? 'underline decoration-1 underline-offset-2' : 'text-accent')}
          >
            {p.mention}
          </Link>
        ),
      )}
    </>
  )
}

/** The list that floats above the composer while an @mention is being typed. */
export function MentionPicker({
  options,
  active,
  onPick,
}: {
  options: MentionOption[]
  active: number
  onPick: (o: MentionOption) => void
}) {
  if (options.length === 0) return null
  return (
    <ul
      role="listbox"
      aria-label="Mention"
      className="ct-animate-pop absolute right-0 bottom-full left-0 z-20 mb-2 max-h-64 overflow-y-auto rounded-xl border border-border bg-surface p-1 shadow-xl"
    >
      {options.map((o, i) => (
        <li key={mentionLabel(o)} role="option" aria-selected={i === active}>
          <button
            type="button"
            // Mousedown, not click: picking must not blur the textarea first.
            onMouseDown={(e) => {
              e.preventDefault()
              onPick(o)
            }}
            className={cn(
              'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left',
              i === active ? 'bg-accent-soft' : 'hover:bg-surface-2',
            )}
          >
            {o.kind === 'channel' ? (
              <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-surface-2 text-accent">
                <Hash size={14} aria-hidden />
              </span>
            ) : (
              <span className="grid size-7 shrink-0 place-items-center overflow-hidden rounded-full bg-surface-2 text-[10.5px] font-semibold text-muted">
                {o.avatar ? <img src={o.avatar} alt="" className="size-full object-cover" /> : initialsOf(o.name, o.handle)}
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium text-fg">
                {o.kind === 'channel' ? o.channel.name : (o.name ?? `@${o.handle}`)}
              </span>
              <span className="block truncate text-[11.5px] text-subtle">
                {o.kind === 'channel' ? o.channel.hint : `@${o.handle}`}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}
