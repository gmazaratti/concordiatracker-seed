import type { Lang } from '@/i18n/i18n'

/**
 * Reading published content that teachers and organizations may have written in
 * both languages.
 *
 * The base column is always the English/default copy; `translations` holds the
 * others as `{ fr: { title, body } }`. A missing or blank French value falls
 * back to the base rather than rendering empty — half-translated content should
 * show English for the parts nobody translated, not gaps. That fallback is the
 * whole reason this is a function and not a lookup.
 */

/** What a row carrying translations looks like, from the client's side. */
export type Translations = Partial<Record<Lang, Record<string, string | null>>>

export interface Translatable {
  translations?: Translations | null
}

/** One field, in the reader's language, falling back to the base value. */
export function localized<T extends Translatable>(
  row: T,
  lang: Lang,
  field: keyof T & string,
): string {
  const base = (row[field] ?? '') as string
  if (lang === 'en') return base
  const value = row.translations?.[lang]?.[field]
  return value && value.trim() ? value : base
}

/** True when this row has a usable translation for the language. */
export function hasTranslation(row: Translatable, lang: Lang, fields: string[]): boolean {
  const bundle = row.translations?.[lang]
  if (!bundle) return false
  return fields.some((f) => !!bundle[f]?.trim())
}

/**
 * Merge an edited language bundle back into a row's translations.
 *
 * Empty strings are DELETED rather than stored: an empty French title should
 * fall back to English, and storing `""` would mean "translated to nothing".
 * It also keeps `hasTranslation` honest — a bundle of blanks isn't a translation.
 */
export function mergeTranslations(
  current: Translations | null | undefined,
  lang: Lang,
  values: Record<string, string>,
): Translations {
  const next: Translations = { ...(current ?? {}) }
  const bundle: Record<string, string> = { ...(next[lang] ?? {}) } as Record<string, string>

  for (const [field, value] of Object.entries(values)) {
    if (value.trim()) bundle[field] = value.trim()
    else delete bundle[field]
  }

  if (Object.keys(bundle).length) next[lang] = bundle
  else delete next[lang]
  return next
}
