import { parseHex, readableOn } from '@/lib/color'

/**
 * A note's page setup, stored on the note (notes.page) so everyone who opens
 * it sees the same page — like a document's page setup, not a viewer setting.
 *
 *   layout 'pages'     a letter-size sheet, with a line where each printed
 *                      page ends, matching the PDF export
 *   layout 'pageless'  one continuous surface, as wide as the reading column
 *
 * color is 'theme' (follows the app's theme), a preset, or any #hex. The page
 * then carries the matching LIGHT or DARK token set, so text, code blocks and
 * checkboxes stay readable on it whatever the app theme is.
 */
export interface PageSetup {
  layout: 'pages' | 'pageless'
  color: string
}

export const DEFAULT_PAGE: PageSetup = { layout: 'pages', color: 'theme' }

export const PAGE_COLORS: { value: string; label: string; swatch: string }[] = [
  { value: 'theme', label: 'Match the app', swatch: 'var(--ct-surface)' },
  { value: '#ffffff', label: 'White', swatch: '#ffffff' },
  { value: '#f8f1e3', label: 'Sepia', swatch: '#f8f1e3' },
  { value: '#eef1f4', label: 'Cool grey', swatch: '#eef1f4' },
  { value: '#1f1f23', label: 'Charcoal', swatch: '#1f1f23' },
  { value: '#101826', label: 'Midnight', swatch: '#101826' },
]

export function readPage(raw: unknown): PageSetup {
  const p = (raw ?? {}) as Partial<PageSetup>
  return {
    layout: p.layout === 'pageless' ? 'pageless' : 'pages',
    color: typeof p.color === 'string' && (p.color === 'theme' || /^#[0-9a-f]{6}$/i.test(p.color)) ? p.color : 'theme',
  }
}

/** The theme the page itself needs, or null to follow the app. */
export function pageTheme(color: string): 'light' | 'dark' | null {
  if (color === 'theme') return null
  if (!parseHex(color)) return null
  // Whichever of black or white text reads better decides the token set.
  return readableOn(color) === '#ffffff' ? 'dark' : 'light'
}

/** Inches → CSS px at 96 dpi: a letter page. */
export const PAGE_WIDTH = 816
export const PAGE_HEIGHT = 1056
