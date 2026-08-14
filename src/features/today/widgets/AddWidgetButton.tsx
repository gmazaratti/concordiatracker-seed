import { useState } from 'react'
import { LayoutGrid } from 'lucide-react'
import { ModalShell } from '@/command/ModalShell'
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
  ctx,
}: {
  layout: string[]
  onChange: (next: string[]) => void
  topLayout: string[]
  onTopChange: (next: string[]) => void
  ctx: WidgetContext
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-border py-2.5 text-[12.5px] font-medium text-subtle transition-colors duration-150 hover:border-border-strong hover:bg-surface/50 hover:text-fg"
      >
        <LayoutGrid size={14} aria-hidden />
        {layout.length ? 'Edit widgets' : 'Add a widget'}
      </button>

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
              ctx={ctx}
            />
          </div>
        </ModalShell>
      )}
    </>
  )
}
