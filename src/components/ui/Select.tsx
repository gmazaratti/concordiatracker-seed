import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, Search } from 'lucide-react'
import { cn } from '@/lib/cn'

export interface SelectOption {
  value: string
  label: string
  /** Optional leading colored dot (a `bg-*` utility) — e.g. status colors. */
  dot?: string
}

type Norm = { value: string; label: string; dot?: string }
type Placement = { left: number; top: number; width: number; above: boolean }

/**
 * Token-styled, keyboard-accessible dropdown — the custom replacement for native
 * `<select>` everywhere in the app. The option list is portaled to <body> with
 * fixed positioning so it never clips against `overflow-hidden`/scroll ancestors,
 * and it repositions on scroll/resize. Focus stays on the trigger (activedescendant
 * pattern), so it composes with modal focus traps.
 */
export function Select({
  value,
  onChange,
  options,
  ariaLabel,
  placeholder = 'Select…',
  size = 'md',
  tone = 'field',
  searchable = false,
  className,
}: {
  value: string
  onChange: (value: string) => void
  options: (SelectOption | string)[]
  ariaLabel: string
  placeholder?: string
  size?: 'sm' | 'md'
  tone?: 'field' | 'control'
  /**
   * Put a filter box at the top of the list.
   *
   * For lists long enough that scrolling them is the wrong interaction — the
   * programme picker is fifty-odd entries, and a student who knows they are in
   * Finance should type four letters rather than hunt. Off by default: on a
   * six-item status list a search box is furniture.
   */
  searchable?: boolean
  className?: string
}) {
  const [query, setQuery] = useState('')
  const all: Norm[] = options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o))
  const needle = query.trim().toLowerCase()
  const opts: Norm[] =
    searchable && needle
      ? all.filter((o) => o.label.toLowerCase().includes(needle))
      : all
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [pos, setPos] = useState<Placement | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const id = useId()

  const selectedIndex = opts.findIndex((o) => o.value === value)
  const selected = selectedIndex >= 0 ? opts[selectedIndex] : null

  const place = useCallback(() => {
    const el = triggerRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const spaceBelow = window.innerHeight - r.bottom
    const above = spaceBelow < 240 && r.top > spaceBelow
    setPos({ left: r.left, top: above ? r.top - 4 : r.bottom + 4, width: r.width, above })
  }, [])

  const openMenu = () => {
    // Never reopens pre-narrowed by the last thing you typed.
    setQuery('')
    setActive(selectedIndex >= 0 ? selectedIndex : 0)
    place()
    setOpen(true)
  }
  const choose = (v: string) => {
    onChange(v)
    setOpen(false)
    triggerRef.current?.focus()
  }

  // Reposition + dismiss while open.
  useEffect(() => {
    if (!open) return
    const reposition = () => place()
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (triggerRef.current?.contains(t) || listRef.current?.contains(t)) return
      setOpen(false)
    }
    window.addEventListener('scroll', reposition, true)
    window.addEventListener('resize', reposition)
    document.addEventListener('mousedown', onDown)
    return () => {
      window.removeEventListener('scroll', reposition, true)
      window.removeEventListener('resize', reposition)
      document.removeEventListener('mousedown', onDown)
    }
  }, [open, place])

  // Keep the highlighted option in view.
  useLayoutEffect(() => {
    if (!open) return
    listRef.current
      ?.querySelector(`[data-i="${active}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [active, open])

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault()
        openMenu()
      }
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      setOpen(false)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => Math.min(opts.length - 1, a + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(0, a - 1))
    } else if (e.key === 'Home') {
      e.preventDefault()
      setActive(0)
    } else if (e.key === 'End') {
      e.preventDefault()
      setActive(opts.length - 1)
    } else if (e.key === 'Enter' || (e.key === ' ' && !searchable)) {
      e.preventDefault()
      e.stopPropagation()
      choose(opts[active]?.value ?? value)
    } else if (e.key === 'Tab') {
      setOpen(false)
    } else if (searchable && e.key === 'Backspace') {
      e.preventDefault()
      setQuery((q) => q.slice(0, -1))
      setActive(0)
    } else if (searchable && e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
      // Typing filters. The trigger is a <button>, not an <input>, so the
      // keystrokes arrive here — which is exactly what keeps focus on the
      // combobox and the arrow keys working while you narrow the list.
      e.preventDefault()
      setQuery((q) => q + e.key)
      setActive(0)
    }
  }

  return (
    <div className={cn('relative', className)}>
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? `${id}-list` : undefined}
        aria-activedescendant={open ? `${id}-${active}` : undefined}
        aria-label={ariaLabel}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={onKeyDown}
        className={cn(
          // h-full so a Select sitting in a stretched row matches the height of
          // the inputs beside it. Outside such a row it resolves to auto.
          'flex h-full w-full items-center gap-2 rounded-lg transition-colors duration-150',
          tone === 'control'
            ? 'border border-border-strong bg-surface-2 hover:bg-surface'
            : 'border border-border bg-canvas hover:border-border-strong',
          size === 'sm' ? 'px-2.5 py-1 text-[12px] font-medium' : 'px-3 py-2 text-[13px]',
        )}
      >
        {selected?.dot && (
          <span className={cn('size-1.5 shrink-0 rounded-full', selected.dot)} aria-hidden />
        )}
        <span className={cn('min-w-0 flex-1 truncate text-left', selected ? 'text-fg' : 'text-subtle')}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown
          size={15}
          className={cn('shrink-0 text-subtle transition-transform duration-150', open && 'rotate-180')}
          aria-hidden
        />
      </button>

      {open &&
        pos &&
        createPortal(
          <ul
            ref={listRef}
            id={`${id}-list`}
            role="listbox"
            aria-label={ariaLabel}
            style={{
              position: 'fixed',
              left: pos.left,
              width: pos.width,
              ...(pos.above
                ? { bottom: window.innerHeight - pos.top }
                : { top: pos.top }),
            }}
            className="ct-animate-pop z-[60] max-h-72 overflow-y-auto rounded-lg border border-border bg-surface p-1 shadow-2xl"
          >
            {searchable && (
              // Typing goes through the TRIGGER, which keeps focus (the
              // aria-activedescendant pattern this control is built on), so
              // this box is display-only and never steals it. That is also what
              // lets the arrow keys keep working while you filter.
              <li className="sticky top-0 z-10 -m-1 mb-1 border-b border-border bg-surface p-2">
                <span className="flex items-center gap-1.5 rounded-md border border-border bg-canvas px-2 py-1">
                  <Search size={12} className="shrink-0 text-subtle" aria-hidden />
                  <span
                    className={cn(
                      'min-w-0 flex-1 truncate text-[12px]',
                      query ? 'text-fg' : 'text-subtle',
                    )}
                  >
                    {query || 'Type to filter…'}
                  </span>
                </span>
              </li>
            )}
            {opts.length === 0 && (
              <li className="px-2.5 py-3 text-center text-[12px] text-subtle">
                Nothing matches &ldquo;{query}&rdquo;
              </li>
            )}
            {opts.map((o, i) => (
              <li
                key={o.value}
                id={`${id}-${i}`}
                data-i={i}
                role="option"
                aria-selected={o.value === value}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => {
                  e.preventDefault()
                  choose(o.value)
                }}
                className={cn(
                  'flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px]',
                  i === active ? 'bg-surface-2 text-fg' : 'text-muted',
                )}
              >
                {o.dot && <span className={cn('size-1.5 shrink-0 rounded-full', o.dot)} aria-hidden />}
                <span className="min-w-0 flex-1">{o.label}</span>
                {o.value === value && <Check size={14} className="shrink-0 text-accent" aria-hidden />}
              </li>
            ))}
          </ul>,
          document.body,
        )}
    </div>
  )
}
