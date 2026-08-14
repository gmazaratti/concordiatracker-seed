import { createContext, useContext } from 'react'
import type { Key } from './en'

export type Lang = 'en' | 'fr'

export const LANGS: { id: Lang; label: string }[] = [
  { id: 'en', label: 'English' },
  { id: 'fr', label: 'Français' },
]

/** Values interpolated into {braces} in a string. */
export type Vars = Record<string, string | number>

export interface I18nContextValue {
  lang: Lang
  setLang: (lang: Lang) => void
  /** Translate a key; falls back to English when French is missing. */
  t: (key: Key, vars?: Vars) => string
}

export const I18nContext = createContext<I18nContextValue | null>(null)

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within <I18nProvider>')
  return ctx
}

/** Convenience: `const t = useT()` then `t('nav.today')`. */
export function useT(): I18nContextValue['t'] {
  return useI18n().t
}
