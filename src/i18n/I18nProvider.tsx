import { useCallback, useEffect, useMemo, useState } from 'react'
import { en, type Key } from './en'
import { fr } from './fr'
import { I18nContext, LANGS, type Lang, type Vars } from './i18n'

const STORAGE_KEY = 'ct_lang'

const DICTS: Record<Lang, Partial<Record<Key, string>>> = { en, fr }

/**
 * Saved language, else English.
 *
 * Deliberately does NOT sniff navigator.language: most Concordia students use
 * the app in English, and silently serving a French UI to anyone whose browser
 * happens to be set to French surprises more people than it helps. French is a
 * first-class choice — offered during onboarding and always in Settings — just
 * not an automatic one.
 */
function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved && LANGS.some((l) => l.id === saved)) return saved as Lang
  } catch {
    /* localStorage unavailable */
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
