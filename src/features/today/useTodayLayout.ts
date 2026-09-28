import { useUiState } from '@/app/providers/ui-state'
import {
  WIDGETS_BY_ID,
  DUE_ID,
  DEFAULT_MAIN,
  MAX_MAIN,
  MAX_WIDGETS,
  sanitizeLayout,
  sizeOf,
  sizesFor,
  type WidgetSize,
} from './widgets/registry'
import type { ZoneSpec } from './widgets/WidgetBoard'

/**
 * Where every widget on Today lives and at what size: the two zones (the wide
 * column and the rail), the writes that move a widget between them, and the
 * size controls. Split out of TodayPage so the page is about what it shows.
 */
export function useTodayLayout() {
  const { uiState, patchUiState } = useUiState()
  // Unknown ids are dropped, so a layout saved against an older build can never
  // crash Today or render a widget twice.
  const widgets = sanitizeLayout(uiState.todayWidgets)
  /**
   * The wide column, migrating the old two-band layout on read.
   *
   * Anyone who had put something above or below their deadlines keeps exactly
   * the arrangement they had — the list simply says so explicitly now, with
   * the due list in the middle where it always was.
   */
  const savedMain =
    uiState.todayMain ??
    [...(uiState.todayTopWidgets ?? []), DUE_ID, ...(uiState.todayBelowWidgets ?? [])]
  const rawMain = sanitizeLayout(savedMain, DEFAULT_MAIN)
  // The one invariant: the due list is on this screen somewhere. A saved
  // layout that has lost it (an old write, a bad merge) gets it back at the
  // top rather than rendering a Today with no deadlines on it.
  const mainWidgets =
    rawMain.includes(DUE_ID) || widgets.includes(DUE_ID) ? rawMain : [DUE_ID, ...rawMain]

  /**
   * Zones are exclusive: a widget lives in exactly one. Writing both at once
   * means dragging the due list into the rail removes it from the main column
   * in the same update, instead of showing it twice or silently refusing.
   */
  function setZone(zone: 'rail' | 'main', next: string[]) {
    const others = (list: string[]) => list.filter((id) => !next.includes(id))
    patchUiState({
      todayWidgets: zone === 'rail' ? next : others(widgets),
      todayMain: zone === 'main' ? next : others(mainWidgets),
    })
  }

  // Zones are declared once so the drag controller and the views agree on
  // capacity, layout, and where a widget currently lives.
  const zones: ZoneSpec[] = [
    { id: 'main', ids: mainWidgets, setIds: (n) => setZone('main', n), layout: 'wide', max: MAX_MAIN },
    { id: 'rail', ids: widgets, setIds: (n) => setZone('rail', n), layout: 'rail', max: MAX_WIDGETS },
  ]
  // Card sizes in the wide column. The rail is one narrow column, so there
  // every card is drawn at its rail layout.
  const sizeFor = (id: string): WidgetSize => {
    const def = WIDGETS_BY_ID.get(id)
    return def ? sizeOf(def, uiState.widgetSizes?.[id]) : 'l'
  }
  const setSize = (id: string, size: WidgetSize) =>
    patchUiState({ widgetSizes: { ...uiState.widgetSizes, [id]: size } })

  /**
   * A card in the rail offers the same sizes. The rail is one narrow column,
   * so a bigger size can only be honoured by moving the card to the wide
   * column, which is what picking one does, in one write so it never shows
   * in both places.
   */
  const railSizes = (id: string): WidgetSize[] => {
    const def = WIDGETS_BY_ID.get(id)
    if (!def) return []
    const bigger = sizesFor(def).filter((sz) => sz !== 's')
    return mainWidgets.length < MAX_MAIN ? ['s', ...bigger] : ['s']
  }
  const growFromRail = (id: string, size: WidgetSize) => {
    if (size === 's' || mainWidgets.length >= MAX_MAIN) return
    patchUiState({
      todayWidgets: widgets.filter((w) => w !== id),
      todayMain: [...mainWidgets.filter((w) => w !== id), id],
      widgetSizes: { ...uiState.widgetSizes, [id]: size },
    })
  }

  return { widgets, mainWidgets, setZone, zones, sizeFor, setSize, railSizes, growFromRail }
}
