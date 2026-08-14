import { useCallback, useEffect, useMemo, useState } from 'react'
import { en, type Key } from './en'
import { fr } from './fr'
import { I18nContext, LANGS, type Lang, type Vars } from './i18n'

const STORAGE_KEY = 'ct_lang'

const DICTS: Record<Lang, Partial<Record<Key, string>>> = { en, fr }

/** Saved language, else the browser's preference, else English. */
function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved && LANGS.some((l) => l.id === saved)) return saved as Lang
  } catch {
    /* localStorage unavailable */
  }
  try {
    // A Montreal visitor whose browser is set to French should land in French.
    if (navigator.language?.toLowerCase().startsWith('fr')) return 'fr'
  } catch {
    /* navigator unavailable */
  }
  return 'en'
}

function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in vars ? String(vars[name]) : whole,
  )
}

/**
 * Interface language. Persisted per device and mirrored onto <html lang>, which
 * matters for screen readers, browser translation prompts, and search engines.
 *
 * Missing French strings fall back to English by design — that's what lets the
 * translation land incrementally without ever showing a raw key or a blank.
 */
export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang)

  useEffect(() => {
    document.documentElement.lang = lang
    try {
      localStorage.setItem(STORAGE_KEY, lang)
    } catch {
      /* localStorage unavailable — language just won't persist */
    }
  }, [lang])

  const setLang = useCallback((next: Lang) => setLangState(next), [])

  const t = useCallback(
    (key: Key, vars?: Vars): string => {
      const dict = DICTS[lang]
      // `?? en[key]` is the fallback that makes partial translation safe.
      return interpolate(dict[key] ?? en[key] ?? key, vars)
    },
    [lang],
  )

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t])

  return <I18nContext value={value}>{children}</I18nContext>
}
