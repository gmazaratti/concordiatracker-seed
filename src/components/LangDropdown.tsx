import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { LANGS, useI18n, type Lang } from '@/i18n/i18n'
import { cn } from '@/lib/cn'

/**
 * The quietest language control: the current language as plain text with a
 * small chevron, no pill and no outline. Opening it offers the other
 * language(s), so French is one click away without the switch competing with
 * the header's real call to action.
 *
 * A button plus a small menu: Escape and a click outside close it, arrow keys
 * move between the options, and focus goes back to the button after choosing.
 */
export function LangDropdown({ className }: { className?: string }) {
  const { lang, setLang } = useI18n()
  const [open, setOpen] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const others = LANGS.filter((l) => l.id !== lang)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        button.current?.focus()
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    // Focus the first option, so the menu is usable from the keyboard at once.
    wrap.current?.querySelector<HTMLButtonElement>('[role=menuitemradio]')?.focus()
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const choose = (id: Lang) => {
    setLang(id)
    setOpen(false)
    button.current?.focus()
  }

  const onMenuKey = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const items = [...(wrap.current?.querySelectorAll<HTMLButtonElement>('[role=menuitemradio]') ?? [])]
    const i = items.indexOf(document.activeElement as HTMLButtonElement)
    const next = (i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
    items[next]?.focus()
  }

  return (
    <div ref={wrap} className={cn('relative', className)}>
      <button
        ref={button}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Language: ${LANGS.find((l) => l.id === lang)?.label ?? lang}`}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[12.5px] font-medium tracking-[0.04em] text-muted uppercase transition-colors duration-150 hover:text-fg focus-visible:outline-2 focus-visible:outline-accent"
      >
        {lang}
        <ChevronDown
          size={13}
          className={cn('transition-transform duration-150', open && 'rotate-180')}
          aria-hidden
        />
      </button>
      {open && (
        <div
          role="menu"
          aria-label="Language / Langue"
          onKeyDown={onMenuKey}
          className="ct-animate-pop absolute top-full right-0 z-50 mt-1.5 min-w-[64px] rounded-lg border border-border bg-surface p-1 shadow-lg"
        >
          {others.map((l) => (
            <button
              key={l.id}
              type="button"
              role="menuitemradio"
              aria-checked={false}
              aria-label={l.label}
              lang={l.id}
              onClick={() => choose(l.id)}
              className="block w-full rounded-md px-2.5 py-1.5 text-left text-[12.5px] font-medium tracking-[0.04em] text-muted uppercase transition-colors duration-150 hover:bg-surface-2 hover:text-fg focus-visible:bg-surface-2 focus-visible:text-fg focus-visible:outline-none"
            >
              {l.id}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
