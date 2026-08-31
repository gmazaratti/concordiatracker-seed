import { createPortal } from 'react-dom'
import { PanelLeft, X } from 'lucide-react'
import { useModalDismiss } from '@/app/hooks/useModalDismiss'
import { cn } from '@/lib/cn'
import type { NavItem, Phase } from './PlannerNav'

/**
 * The planner's sidebar, on a phone.
 *
 * It is the SAME rail as the desktop one — same order, same phase headings —
 * slid in from the left instead of docked. That matters: a dropdown listed the
 * eight sections as eight equal strings and lost the thing the rail exists to
 * communicate, which is that they are a SEQUENCE. Know where you stand, explore
 * what you could take, commit to it. Stripped of that grouping the list reads
 * as eight unrelated pages and picking one becomes a guess.
 *
 * A horizontal scrolling strip was worse again: most of it off-screen at any
 * moment, so you could see neither where you were nor what else existed.
 */
const PHASE_LABEL: Record<Phase, string> = {
  know: 'What you have done',
  explore: 'What you could take',
  commit: 'What you are taking',
}

export function PlannerDrawer<T extends string>({
  items,
  active,
  onChange,
  open,
  onClose,
}: {
  items: NavItem<T>[]
  active: T
  onChange: (id: T) => void
  open: boolean
  onClose: () => void
}) {
  // Mounted only while open, so the dismiss hook below (focus trap, scroll
  // lock, focus restore) can be called unconditionally where it belongs.
  if (!open) return null
  return <Panel items={items} active={active} onChange={onChange} onClose={onClose} />
}

function Panel<T extends string>({
  items,
  active,
  onChange,
  onClose,
}: {
  items: NavItem<T>[]
  active: T
  onChange: (id: T) => void
  onClose: () => void
}) {
  // Focus trap, Escape, scroll lock and focus restore, shared with every other
  // dialog in the app.
  const dismiss = useModalDismiss<HTMLDivElement>(onClose)

  return createPortal(
    <div className="fixed inset-0 z-50 lg:hidden">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
      />
      <div
        {...dismiss}
        role="dialog"
        aria-modal="true"
        aria-label="Planner sections"
        className="ct-drawer-in absolute inset-y-0 left-0 flex w-[min(19rem,85vw)] flex-col border-r border-border bg-surface pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="font-display text-[16px] font-medium text-fg">Planner</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid size-8 place-items-center rounded-lg text-subtle transition-colors duration-150 active:bg-surface-2"
          >
            <X size={17} aria-hidden />
          </button>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto p-2">
          {items.map((item, i) => {
            const Icon = item.icon
            const on = active === item.id
            const startsPhase = i === 0 || items[i - 1].phase !== item.phase
            return (
              <div key={item.id}>
                {startsPhase && (
                  <p
                    className={cn(
                      'px-3 text-[10.5px] font-semibold tracking-wide text-subtle uppercase',
                      i === 0 ? 'pb-1.5' : 'pt-4 pb-1.5',
                    )}
                  >
                    {PHASE_LABEL[item.phase]}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => {
                    onChange(item.id)
                    onClose()
                  }}
                  aria-current={on ? 'page' : undefined}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-[14px] font-medium transition-colors duration-150',
                    on ? 'bg-accent-soft text-fg' : 'text-muted active:bg-surface-2',
                  )}
                >
                  <Icon size={16} aria-hidden className={cn('shrink-0', on && 'text-accent')} />
                  {item.label}
                </button>
              </div>
            )
          })}
        </nav>
      </div>
    </div>,
    document.body,
  )
}

/**
 * What opens it. Shows the section you are in, so the closed state still
 * answers "where am I" without being tapped.
 */
export function PlannerDrawerButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mb-4 flex w-full items-center gap-2.5 rounded-xl border border-border bg-surface px-3.5 py-2.5 text-left transition-colors duration-150 active:bg-surface-2 lg:hidden"
    >
      <PanelLeft size={16} aria-hidden className="shrink-0 text-subtle" />
      <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-fg">{label}</span>
      <span className="shrink-0 text-[11.5px] text-subtle">Sections</span>
    </button>
  )
}
