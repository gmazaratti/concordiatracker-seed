import { useRef } from 'react'
import { useI18n, LANGS, type Lang } from '@/i18n/i18n'
import { cn } from '@/lib/cn'

/**
 * EN | FR as one segmented pill, with a thumb that slides to the active side.
 *
 * Both options are the same size and weight (Bill 96: French on terms at least
 * as favourable), so the thumb is the only thing that says which is on. Buttons
 * with `aria-pressed` rather than a radiogroup, because each one is a plain
 * action ("switch to French") and that is what a screen reader should announce;
 * the arrow keys still move between them for anyone who expects a segmented
 * control to behave like one.
 */
export function LangSwitch({ className }: { className?: string }) {
  const { lang, setLang } = useI18n()
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const index = Math.max(0, LANGS.findIndex((l) => l.id === lang))

  function onKey(e: React.KeyboardEvent, i: number) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    const next = (i + (e.key === 'ArrowRight' ? 1 : -1) + LANGS.length) % LANGS.length
    setLang(LANGS[next].id as Lang)
    refs.current[next]?.focus()
  }

  return (
    <div
      role="group"
      aria-label="Language / Langue"
      className={cn(
        'relative grid h-8 grid-cols-2 rounded-full border border-border bg-surface/70 p-[3px]',
        className,
      )}
    >
      <span
        aria-hidden
        className="absolute top-[3px] bottom-[3px] left-[3px] w-[calc(50%-3px)] rounded-full bg-surface-2 shadow-[inset_0_0_0_1px_var(--ct-border-strong)] transition-[translate] duration-200 ease-out"
        style={{ translate: `${index * 100}% 0` }}
      />
      {LANGS.map((l, i) => {
        const active = l.id === lang
        return (
          <button
            key={l.id}
            ref={(n) => {
              refs.current[i] = n
            }}
            type="button"
            aria-pressed={active}
            aria-label={l.label}
            lang={l.id}
            onClick={() => setLang(l.id)}
            onKeyDown={(e) => onKey(e, i)}
            className={cn(
              'relative z-10 min-w-9 rounded-full px-2.5 text-[11.5px] font-semibold tracking-[0.06em] uppercase transition-colors duration-150',
              'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent',
              active ? 'text-fg' : 'text-subtle hover:text-fg',
            )}
          >
            {l.id}
          </button>
        )
      })}
    </div>
  )
}
