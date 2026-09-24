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
 * Sized like the header's other items (32px tall, 13px text) so it sits on
 * the same centre line. The chevron turns over when French is on, which is
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
        'inline-flex h-8 items-center gap-1 rounded-md px-2 text-[13px] leading-none font-medium tracking-[0.04em] text-muted uppercase transition-[color,transform] duration-150 hover:text-fg active:scale-[0.97]',
        className,
      )}
    >
      <span lang={lang}>{lang}</span>
      <ChevronDown
        size={14}
        className={cn('transition-transform duration-200', lang === 'fr' && 'rotate-180')}
        aria-hidden
      />
    </button>
  )
}
