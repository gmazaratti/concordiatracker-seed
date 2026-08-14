import { useState } from 'react'
import { Check, LayoutGrid, Pencil } from 'lucide-react'
import { ModalShell } from '@/command/ModalShell'
import { cn } from '@/lib/cn'
import { WidgetGallery } from './WidgetGallery'
import type { WidgetContext } from './registry'

/**
 * The entry point to the widget gallery, sitting at the FOOT OF THE RAIL rather
 * than inside a settings panel.
 *
 * Placement is the point: you customize where the widgets actually are, the way
 * you do on a phone home screen. It's also the app's feature directory — new
 * campus tools ship as widgets, so this button is how anyone finds out they
 * exist. Buried in a menu, it wouldn't do that job.
 */
export function AddWidgetButton({
  layout,
  onChange,
  topLayout,
  onTopChange,
  belowLayout,
  onBelowChange,
  ctx,
  editing,
  onToggleEditing,
}: {
  editing: boolean
  onToggleEditing: () => void
  layout: string[]
  onChange: (next: string[]) => void
  topLayout: string[]
  onTopChange: (next: string[]) => void
  belowLayout: string[]
  onBelowChange: (next: string[]) => void
  ctx: WidgetContext
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-dashed border-border py-2.5 text-[12.5px] font-medium text-subtle transition-colors duration-150 hover:border-border-strong hover:bg-surface/50 hover:text-fg"
        >
          <LayoutGrid size={14} aria-hidden />
          Add a widget
        </button>
        {(layout.length > 1 || topLayout.length > 0) && (
          <button
            type="button"
            onClick={onToggleEditing}
            aria-pressed={editing}
            title={editing ? 'Done rearranging' : 'Rearrange widgets'}
            className={cn(
              'grid w-11 place-items-center rounded-xl border py-2.5 transition-colors duration-150',
              editing
                ? 'border-accent bg-accent-soft text-accent'
                : 'border-dashed border-border text-subtle hover:border-border-strong hover:text-fg',
            )}
          >
            {editing ? <Check size={15} aria-hidden /> : <Pencil size={14} aria-hidden />}
          </button>
        )}
      </div>

      {open && (
        <ModalShell label="Widgets" onClose={() => setOpen(false)} widthClass="sm:max-w-md">
          <div className="p-5">
            <h2 className="font-display text-[18px] font-semibold text-fg">Widgets</h2>
            <p className="mt-0.5 mb-4 text-[12.5px] text-subtle">
              Pick what shows beside your due list. Nothing here is required — your deadlines
              stay put either way.
            </p>
            <WidgetGallery
              layout={layout}
              onChange={onChange}
              topLayout={topLayout}
              onTopChange={onTopChange}
              belowLayout={belowLayout}
              onBelowChange={onBelowChange}
              ctx={ctx}
            />
          </div>
        </ModalShell>
      )}
    </>
  )
}
