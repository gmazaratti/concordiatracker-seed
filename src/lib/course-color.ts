/** Per-class accent colors — the Google-Classroom touch. These are deliberately
 * fixed hex values (not theme tokens): a class keeps its identity color across
 * both themes, the way Classroom does. Each reads clearly as a banner with white
 * text on the dark canvas. `soft`/`line` are derived at the call site via alpha. */
export interface CourseColor {
  id: string
  label: string
  hex: string
}

export const COURSE_COLORS: CourseColor[] = [
  { id: 'blue', label: 'Blue', hex: '#3f7fd6' },
  { id: 'teal', label: 'Teal', hex: '#1c9c91' },
  { id: 'green', label: 'Green', hex: '#4f9d5b' },
  { id: 'amber', label: 'Amber', hex: '#d29a36' },
  { id: 'orange', label: 'Orange', hex: '#cf7039' },
  { id: 'rose', label: 'Rose', hex: '#cf5470' },
  { id: 'purple', label: 'Purple', hex: '#8869c4' },
  { id: 'slate', label: 'Slate', hex: '#647084' },
]

const FALLBACK = COURSE_COLORS[0]

/** Resolve a class color id to its definition (falls back to the first color). */
export function courseColor(id: string): CourseColor {
  return COURSE_COLORS.find((c) => c.id === id) ?? FALLBACK
}

/** Hex with an alpha suffix (0–1) — e.g. soft fills and hairlines from one hex. */
export function withAlpha(hex: string, alpha: number): string {
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255)
    .toString(16)
    .padStart(2, '0')
  return `${hex}${a}`
}
