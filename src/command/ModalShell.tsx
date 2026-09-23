import { X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useVisualViewport } from '@/app/hooks/useVisualViewport'
import { cn } from '@/lib/cn'

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'

/** The shared popup shell for quick-action detail views: a centered dialog
 * (bottom sheet on mobile) with backdrop dismissal, Escape to close, a focus
 * trap, scroll lock, and focus restore. CSS-only entrance, reduced-motion safe. */
export function ModalShell({
  label,
  onClose,
  children,
  widthClass = 'sm:max-w-md',
  scroll = true,
}: {
  label: string
  onClose: () => void
  children: React.ReactNode
  /** Override the dialog's max width (default sm:max-w-md). */
  widthClass?: string
  /** When true (default) children live in a single scroll wrapper. Set false to
   * let the child own its own layout (e.g. a pinned header/footer with only the
   * middle scrolling, so the scrollbar never grazes the rounded corners). */
  scroll?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const restoreRef = useRef<Element | null>(null)
  /*
   * PINNED TO WHAT IS ON SCREEN, not to the layout viewport.
   *
   * Focusing the composer made iOS scroll the visual viewport, which took the
   * page — and this fixed overlay with it — up and out of frame. Sizing the
   * overlay to `visualViewport` instead means it always covers exactly the
   * visible area: the background cannot appear to move because it is behind a
   * surface that did not, and the sheet's own flex layout leaves the composer
   * at the visible bottom with no separate transform to keep in step.
   */
  const vp = useVisualViewport()
  const dragRef = useRef<{ y: number; t: number; last: number; v: number } | null>(null)

  /**
   * Slide the sheet down to dismiss it (phones only).
   *
   * Three ways out, which is what a bottom sheet is expected to have: tap
   * above it, drag it down, or press the X. The gesture is 1:1 with the
   * finger and projects the release velocity, so a flick closes and a slow
   * tug that stops short springs back — the same rule the schedule builder's
   * drag follows.
   *
   * THE TRANSFORM IS REMOVED THE MOMENT THE GESTURE ENDS, never left at
   * `translateY(0)`. A transformed element becomes the containing block for
   * every `position: fixed` descendant, and the custom Select and date picker
   * inside these dialogs portal themselves as fixed — leaving an identity
   * transform behind would trap their popovers inside the sheet. (See the
   * `ct-section-in` bug: a `both`-filled transform did exactly that to the
   * full-screen chat.)
   */
  function onSheetDown(e: React.PointerEvent) {
    if (e.pointerType === 'mouse' || window.innerWidth >= 640) return
    const el = ref.current
    if (!el) return
    // Capture, or the gesture dies the moment the finger leaves the 24px
    // handle — which is immediately, since the whole point is moving down.
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = { y: e.clientY, t: performance.now(), last: e.clientY, v: 0 }
    el.style.transition = 'none'
  }

  function onSheetMove(e: React.PointerEvent) {
    const d = dragRef.current
    const el = ref.current
    if (!d || !el) return
    const dy = e.clientY - d.y
    const now = performance.now()
    if (now > d.t) d.v = ((e.clientY - d.last) / (now - d.t)) * 1000
    d.t = now
    d.last = e.clientY
    // Upward drags resist rather than stop dead: a hard stop reads as frozen.
    el.style.transform = `translateY(${dy > 0 ? dy : dy / 4}px)`
  }

  function onSheetUp() {
    const d = dragRef.current
    const el = ref.current
    dragRef.current = null
    if (!d || !el) return
    const dy = d.last - d.y
    // Project where the flick was heading, the way a scroll decelerates,
    // rather than judging the raw distance at the instant of release.
    const projected = dy + (d.v / 1000) * 0.998 / (1 - 0.998)
    if (projected > 110) {
      onClose()
      return
    }
    el.style.transition = 'transform 220ms cubic-bezier(0.2,0.8,0.2,1)'
    el.style.transform = 'translateY(0)'
    window.setTimeout(() => {
      if (!ref.current) return
      ref.current.style.transform = ''
      ref.current.style.transition = ''
    }, 240)
  }

  useEffect(() => {
    restoreRef.current = document.activeElement
    document.body.style.overflow = 'hidden'
    const id = requestAnimationFrame(() => {
      const first = ref.current?.querySelector<HTMLElement>(FOCUSABLE)
      // preventScroll so focusing a far-down control doesn't jump the modal to
      // the bottom on open.
      ;(first ?? ref.current)?.focus({ preventScroll: true })
    })
    return () => {
      cancelAnimationFrame(id)
      document.body.style.overflow = ''
      if (restoreRef.current instanceof HTMLElement) restoreRef.current.focus()
    }
  }, [])

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault()
      // React events bubble through portals to the PARENT dialog, so without
      // this Escape in a dialog opened from a dialog closed both.
      e.stopPropagation()
      onClose()
      return
    }
    if (e.key !== 'Tab' || !ref.current) return
    const items = [...ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)]
    if (items.length === 0) return
    const first = items[0]
    const last = items[items.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  /*
   * PORTALLED TO <body>, and this is a correctness fix rather than tidiness.
   * A `position: fixed` overlay is positioned against the nearest ancestor
   * with a transform, filter, backdrop-filter, perspective, contain or
   * will-change — and this shell is opened from inside a chat bubble, a
   * Community section and an animated card, all of which have had one.
   * Measured before the fix: opening an event embed in a DM rendered the
   * full-screen dim at 589x222, clipped to the bubble, which is why the page
   * behind looked broken. Chasing each animation is a game you lose the next
   * time somebody adds one; leaving the tree ends the class of bug.
   * (Select, DropdownMenu and DateTimePicker already portal for this reason.)
   */
  return createPortal(
    <div
      /* A plain dim, no backdrop-blur. Over a dense surface — a chat with an
         event banner in it — a 4px blur reads as a rendering fault rather than
         a material, and it forces the whole page behind the dialog to
         re-composite for nothing. Dimming further does the same job and is
         unambiguous. */
      /* NO BOTTOM PADDING ON A PHONE. It used to hold the sheet clear of the
         home indicator, which left a strip of dead black under the composer
         — and the composer is the one thing that should sit at the very edge
         of the screen. The sheet runs to the bottom now and the INSET MOVES
         INSIDE, onto whatever the sheet's last row is, so the controls are
         still reachable and the surface is continuous. */
      className={cn(
        'ct-animate-fade fixed left-0 z-[100] flex w-full items-end justify-center bg-black/65 p-0 sm:items-center sm:p-4',
        // Until the first measurement, plain CSS — so a browser with no
        // visualViewport (and the first paint everywhere) is unchanged.
        !vp.ready && 'inset-0',
      )}
      style={vp.ready ? { top: vp.top, height: vp.height } : undefined}
      onMouseDown={onClose}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className={cn(
          // On a phone this IS a bottom sheet, so it comes up from the
          // bottom rather than scaling out of its own centre. Above `sm` the
          // class reverts to the pop — see index.css.
          // `max-h-full`: the overlay is only as tall as the visible area, so
          // a sheet asking for 72vh of the LAYOUT viewport would overflow it
          // the moment the keyboard is up.
          'ct-sheet-in relative max-h-full w-full overflow-hidden rounded-t-2xl border border-border bg-surface shadow-2xl outline-none sm:rounded-2xl',
          widthClass,
        )}
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        {/* The grabber. Phone only, and it is the drag target rather than the
            whole sheet: the sheet's body scrolls, and a pull-down anywhere
            inside it would fight that scroll on every single swipe. */}
        <div
          onPointerDown={onSheetDown}
          onPointerMove={onSheetMove}
          onPointerUp={onSheetUp}
          onPointerCancel={onSheetUp}
          className="flex h-6 shrink-0 touch-none items-center justify-center sm:hidden"
        >
          <span className="h-1 w-9 rounded-full bg-border-strong" aria-hidden />
        </div>

        {/* A visible way out, on EVERY size. It used to be `sm:hidden` on the
            theory that desktop has Escape and a backdrop click — but neither is
            visible, and "there is no close button" is the first thing people
            say about these. A dialog that can be dismissed should look like it
            can. It lives here so no individual modal has to remember it. */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 z-10 grid size-8 place-items-center rounded-lg bg-surface-2/90 text-subtle transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
        >
          <X size={17} aria-hidden />
        </button>
        {/* Scroll lives on an inner wrapper so the scrollbar is clipped to the
            rounded corners (the outer box owns the radius + overflow-hidden).
            When `scroll` is false the child owns its own layout instead. */}
        {scroll ? (
          <div className="max-h-[85vh] overflow-y-auto pb-[env(safe-area-inset-bottom)] sm:pb-0">
            {children}
          </div>
        ) : (
          children
        )}
      </div>
    </div>,
    document.body,
  )
}
