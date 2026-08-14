import { useI18n, LANGS } from '@/i18n/i18n'
import { cn } from '@/lib/cn'

/**
 * Compact EN | FR switch for the public header.
 *
 * Bill 96 asks that French be available on terms at least as favourable as the
 * other language, so the two options are rendered identically — same size, same
 * weight, neither styled as the "real" one. English is simply the default.
 */
export function LangToggle({ className }: { className?: string }) {
  const { lang, setLang } = useI18n()
  return (
    <div
      role="radiogroup"
      aria-label="Language / Langue"
      className={cn('flex items-center rounded-lg border border-border p-0.5', className)}
    >
      {LANGS.map((l) => {
        const active = l.id === lang
        return (
          <button
            key={l.id}
            type="button"
            role="radio"
            aria-checked={active}
            // Full name for screen readers; the visible label stays compact.
            aria-label={l.label}
            onClick={() => setLang(l.id)}
            className={cn(
              'rounded-md px-2 py-1 text-[12px] font-medium uppercase transition-colors duration-150',
              active ? 'bg-surface-2 text-fg' : 'text-subtle hover:text-fg',
            )}
          >
            {l.id}
          </button>
        )
      })}
    </div>
  )
}
