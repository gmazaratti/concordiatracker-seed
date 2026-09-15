import { LIGHT_SHEET, type SchedulePalette } from './schedule-image'

/**
 * The app's live theme, as the six colours the schedule sheet draws from.
 *
 * Reads the `--ct-*` tokens off the document, which is the whole point: a
 * custom accent or a custom page colour is already in there, so the sheet
 * follows a theme nobody wrote a special case for. Kept OUT of
 * `schedule-image.ts` so that module stays pure and Node-testable.
 *
 * Falls back to the light sheet outside a browser or before the tokens exist.
 */
export function themeSheet(): SchedulePalette {
  if (typeof document === 'undefined') return LIGHT_SHEET
  const css = getComputedStyle(document.documentElement)
  const v = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback
  return {
    paper: v('--ct-surface', LIGHT_SHEET.paper),
    ink: v('--ct-fg', LIGHT_SHEET.ink),
    inkSoft: v('--ct-muted', LIGHT_SHEET.inkSoft),
    inkFaint: v('--ct-subtle', LIGHT_SHEET.inkFaint),
    rule: v('--ct-border-strong', LIGHT_SHEET.rule),
    ruleSoft: v('--ct-border', LIGHT_SHEET.ruleSoft),
  }
}
