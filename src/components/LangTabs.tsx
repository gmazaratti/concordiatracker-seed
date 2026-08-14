import { Check, Languages } from 'lucide-react'
import { LANGS, type Lang } from '@/i18n/i18n'
import { cn } from '@/lib/cn'

/**
 * Language switcher for publishing forms — which version you're editing, not
 * which language the interface is in.
 *
 * A tick marks a language that already has content, so an organizer can see at
 * a glance whether the French version exists without switching to it. The
 * default language is always ticked; it's required.
 */
export function LangTabs({
  value,
  onChange,
  filled,
  hint,
  className,
}: {
  value: Lang
  onChange: (lang: Lang) => void
  /** Languages that already have content. 'en' is implicitly always filled. */
  filled: Lang[]
  /** Optional line under the tabs, e.g. what happens when a version is blank. */
  hint?: string
  className?: string
}) {
  return (
    <div className={cn('mb-3', className)}>
      <div className="flex items-center gap-2">
        <Languages size={14} className="shrink-0 text-subtle" aria-hidden />
        <div
          role="tablist"
          aria-label="Language being edited"
          className="flex gap-1 rounded-lg border border-border bg-surface p-0.5"
        >
          {LANGS.map((l) => {
            const active = l.id === value
            const done = l.id === 'en' || filled.includes(l.id)
            return (
              <button
                key={l.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onChange(l.id)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12.5px] font-medium transition-colors duration-150',
                  active ? 'bg-surface-2 text-fg' : 'text-muted hover:text-fg',
                )}
              >
                {l.label}
                {done ? (
                  <Check size={12} className="text-success" aria-label="has content" />
                ) : (
                  <span
                    className="size-1.5 rounded-full bg-border-strong"
                    aria-label="empty"
                  />
                )}
              </button>
            )
          })}
        </div>
      </div>
      {hint && <p className="mt-1.5 text-[11.5px] text-subtle">{hint}</p>}
    </div>
  )
}
