import { ChevronDown } from 'lucide-react'
import { LANGS, useI18n } from '@/i18n/i18n'
import { cn } from '@/lib/cn'

/**
 * The quietest language control: the current language as plain text with a
 * small chevron, no pill and no outline. Pressing it (click, Enter or Space,
 * since it is a real button) switches the page straight to the other
 * language. There are two, so a menu to pick one of them was a step for
 * nothing.
 *
 * Sized like the header's other items (32px tall, 13px text, 1.5 line
 * height) so it sits on the same baseline. The line height matters: with
 * `leading-none` the text box was 13px where the links' is 19.5px, so it
 * centred onto a different sub-pixel and rendered 1px high. The chevron turns over when French is on, which is
 * the only other thing that says which way it will go next.
 */
export function LangTextToggle({ className }: { className?: string }) {
  const { lang, setLang } = useI18n()
  const i = Math.max(0, LANGS.findIndex((l) => l.id === lang))
  const next = LANGS[(i + 1) % LANGS.length]
  return (
    <button
      type="button"
      onClick={() => setLang(next.id)}
      aria-label={`${LANGS[i].label}. Switch to ${next.label}`}
      className={cn(
        'inline-flex h-8 items-center gap-1 rounded-md px-2 text-[13px] leading-[1.5] font-medium tracking-[0.04em] text-muted uppercase transition-[color,transform] duration-150 hover:text-fg active:scale-[0.97]',
        className,
      )}
    >
      {/* Both codes share one grid cell so the control is the width of the
          wider one in either language: the thing you just pressed stays put. */}
      <span className="grid">
        {LANGS.map((l) => (
          <span
            key={l.id}
            lang={l.id}
            aria-hidden={l.id !== lang || undefined}
            className={cn('col-start-1 row-start-1', l.id !== lang && 'invisible')}
          >
            {l.id}
          </span>
        ))}
      </span>
      <ChevronDown
        size={14}
        className={cn('transition-transform duration-200', lang === 'fr' && 'rotate-180')}
        aria-hidden
      />
    </button>
  )
}
