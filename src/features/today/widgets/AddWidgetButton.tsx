import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Check, LayoutGrid, Pencil } from 'lucide-react'
import { ModalShell } from '@/command/ModalShell'
import { cn } from '@/lib/cn'
import { WidgetGallery } from './WidgetGallery'
import { BackgroundSetting } from '../background/BackgroundSetting'
import { useIsAdmin } from '@/features/admin/admin-data'
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
  mainLayout,
  onMainChange,
  ctx,
  editing,
  onToggleEditing,
}: {
  editing: boolean
  onToggleEditing: () => void
  layout: string[]
  onChange: (next: string[]) => void
  mainLayout: string[]
  onMainChange: (next: string[]) => void
  ctx: WidgetContext
}) {
  const [open, setOpen] = useState(false)
  // The Today background is a trial, shown to admins only for now.
  const { isAdmin } = useIsAdmin()

  // `?widgets=1` opens the gallery: the Getting started step "Add a widget"
  // links here, and landing on Today with nothing open would leave the student
  // to find the button themselves. Opened during render (so it is open on the
  // first paint), and the parameter is dropped afterwards so a reload or Back
  // does not open it again.
  const [params, setParams] = useSearchParams()
  const asked = params.get('widgets') === '1'
  if (asked && !open) setOpen(true)
  useEffect(() => {
    if (!asked) return
    const next = new URLSearchParams(params)
    next.delete('widgets')
    setParams(next, { replace: true })
  }, [asked, params, setParams])

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
        {(layout.length > 1 || mainLayout.length > 1) && (
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
        <ModalShell label="Widgets" onClose={() => setOpen(false)} widthClass="sm:max-w-2xl">
          <div className="p-5">
            <h2 className="font-display text-[18px] font-semibold text-fg">Widgets</h2>
            <p className="mt-0.5 mb-4 text-[12.5px] text-subtle">
              Every widget below is shown with your real data: what you see is what you
              get. Drag anything on Today itself (double-click a card's header to start)
              to move it between the wide column and the side rail.
            </p>
            {isAdmin && <BackgroundSetting />}
            <WidgetGallery
              layout={layout}
              onChange={onChange}
              mainLayout={mainLayout}
              onMainChange={onMainChange}
              ctx={ctx}
            />
          </div>
        </ModalShell>
      )}
    </>
  )
}
