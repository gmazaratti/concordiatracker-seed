import { Check } from 'lucide-react'
import { ModalShell } from '@/command/ModalShell'
import { MESSAGE_FILTERS, type MessageFilterId } from './message-filters'
import { cn } from '@/lib/cn'

/**
 * The filter sheet behind the slider button on the conversation list.
 *
 * ROWS WITH A TICK, not switches. A switch says "this setting is on until I
 * turn it off"; these are a lens you hold over the list for a moment, and the
 * tick is what every messaging app uses for exactly that reason. They also
 * read correctly when two are on at once, which a column of switches does not
 * — see the AND rule in `message-filters.ts`.
 *
 * CLEAR ALL IS ALWAYS RENDERED, disabled when there is nothing to clear. A
 * control that appears only once you are stuck is a control nobody knows
 * exists, and the badge on the button outside is the other half of the same
 * problem: a filter you have forgotten about makes the product look broken.
 */
export function MessageFilterSheet({
  active,
  onToggle,
  onClear,
  onClose,
}: {
  active: Set<MessageFilterId>
  onToggle: (id: MessageFilterId) => void
  onClear: () => void
  onClose: () => void
}) {
  return (
    <ModalShell label="Filter conversations" onClose={onClose} widthClass="sm:max-w-sm">
      <div className="px-4 pt-3 pb-4">
        <div className="mb-1 flex items-baseline justify-between gap-3 pr-9">
          <h2 className="text-[15px] font-semibold text-fg">Filter by</h2>
          <button
            type="button"
            onClick={onClear}
            disabled={active.size === 0}
            className="text-[12.5px] font-medium text-accent transition-opacity duration-150 disabled:opacity-40"
          >
            Clear all
          </button>
        </div>

        <ul>
          {MESSAGE_FILTERS.map((f) => {
            const on = active.has(f.id)
            return (
              <li key={f.id}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  onClick={() => onToggle(f.id)}
                  className="flex w-full items-center gap-3 rounded-xl px-1 py-3 text-left transition-colors duration-150 hover:bg-surface-2/60"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] text-fg">{f.label}</span>
                    <span className="block text-[11.5px] leading-snug text-subtle">{f.hint}</span>
                  </span>
                  {/* A box, not a colour change on the label: the state has to
                      be readable without relying on colour. */}
                  <span
                    aria-hidden
                    className={cn(
                      'grid size-[22px] shrink-0 place-items-center rounded-md border transition-colors duration-150',
                      on ? 'border-accent bg-accent text-accent-contrast' : 'border-border-strong',
                    )}
                  >
                    {on && <Check size={14} strokeWidth={3} />}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </ModalShell>
  )
}
