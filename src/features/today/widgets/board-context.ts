import { createContext, useContext } from 'react'
import { fitsZone, sizesFor, type WidgetDef, type WidgetZone } from './registry'

/*
 * Shared between the board (the drag controller) and its zones. Split out of
 * WidgetBoard.tsx so each file stays one job; nothing here renders.
 */

/** The wide column is a grid of sized cards, so it takes any widget (a
 *  side-only one goes in Small); the rail still takes only rail layouts. */
export function zoneAccepts(w: WidgetDef, layout: WidgetZone): boolean {
  return layout === 'wide' ? sizesFor(w).length > 0 : fitsZone(w, layout)
}

export interface ZoneSpec {
  id: string
  ids: string[]
  /**
   * Set this zone's contents. MUST also remove those ids from every other zone
   * in the same update — the board relies on that for cross-zone moves.
   */
  setIds: (next: string[]) => void
  /** Which widget layout this zone renders. */
  layout: WidgetZone
  max: number
}

export interface DragState {
  id: string
  fromZone: string
  /** Pointer offset inside the widget, so it doesn't jump to the cursor. */
  dx: number
  dy: number
  width: number
  x: number
  y: number
}

/**
 * How far down an item still counts as "the header".
 *
 * Double-clicking the top bar is what turns edit mode on, the way holding an
 * icon does on a phone. It is a band rather than a real element because every
 * widget draws its own header — WidgetCard's title row, the due list's, the
 * glance panel's — and a shared handle would have meant rewriting all of them
 * to hang one gesture off.
 */
export const HEADER_BAND = 44

export interface BoardCtx {
  editing: boolean
  requestEdit: () => void
  drag: DragState | null
  hoverZone: string | null
  registerZone: (id: string, el: HTMLElement | null) => void
  registerItem: (zone: string, id: string, el: HTMLElement | null) => void
  begin: (zone: string, id: string, e: React.PointerEvent) => void
  remove: (zone: string, id: string) => void
}

export const Ctx = createContext<BoardCtx | null>(null)

export function useBoard(): BoardCtx {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useBoard must be used within <WidgetBoard>')
  return ctx
}
