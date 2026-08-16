import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/cn'
import { GRADE_LETTERS, parseFinalGrade, percentToGrade } from '@/lib/gpa'

/**
 * A grade field that takes either a percentage or a letter.
 *
 * Both are legitimate: a transcript shows letters, a syllabus shows percentages,
 * and which one a student reaches for depends on the document in front of them.
 * So this is a combobox rather than a select - you can type 87, or pick A-.
 *
 * The letter list is a portaled popover, not a native <datalist>. A datalist
 * renders in the browser's own chrome: light grey on a dark app, wrong font,
 * wrong everything, and unstyleable. This project already banned native selects
 * and colour inputs for the same reason.
 */
export function GradeField({
  value,
  onChange,
  ariaLabel,
  placeholder = 'Grade',
  className,
}: {
  value: string
  onChange: (next: string) => void
  ariaLabel: string
  placeholder?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const id = useId()

  const percent = value.trim() === '' ? null : parseFinalGrade(value)
  const invalid = value.trim() !== '' && percent === null
  // Typing a percentage and seeing the letter confirms the scale is being
  // applied, which matters when entering a dozen of them in a row.
  const hint = percent !== null && !/^[A-Za-z]/.test(value.trim()) ? percentToGrade(percent).letter : null

  useEffect(() => {
    if (!open) return
    const place = () => {
      const r = wrapRef.current?.getBoundingClientRect()
      if (!r) return
      // Flip up when there isn't room below, so the list is never off-screen.
      const below = window.innerHeight - r.bottom
      const height = Math.min(GRADE_LETTERS.length * 30 + 8, 260)
      setPos({
        top: below < height ? r.top - height - 4 : r.bottom + 4,
        left: r.left,
        width: r.width,
      })
    }
    place()
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    document.addEventListener('mousedown', onDown)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
      document.removeEventListener('mousedown', onDown)
    }
  }, [open])

  return (
    <div ref={wrapRef} className={cn('relative', className)}>
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && open) {
            e.stopPropagation()
            setOpen(false)
          }
          if (e.key === 'ArrowDown' && !open) {
            e.preventDefault()
            setOpen(true)
          }
        }}
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        role="combobox"
        autoComplete="off"
        className={cn(
          'h-full w-full rounded-lg border bg-canvas py-2 pr-14 pl-3 text-[13px] text-fg placeholder:text-subtle focus:outline-none',
          invalid ? 'border-danger' : 'border-border focus:border-accent',
        )}
      />

      {hint && (
        <span className="pointer-events-none absolute top-1/2 right-8 -translate-y-1/2 text-[11px] font-medium text-subtle">
          {hint}
        </span>
      )}

      <button
        type="button"
        tabIndex={-1}
        aria-label="Choose a letter grade"
        onClick={() => {
          setOpen((o) => !o)
          inputRef.current?.focus()
        }}
        className="absolute top-1/2 right-1.5 grid size-6 -translate-y-1/2 place-items-center rounded text-subtle transition-colors duration-150 hover:text-fg"
      >
        <ChevronDown size={14} aria-hidden className={cn(open && 'rotate-180')} />
      </button>

      {open &&
        pos &&
        createPortal(
          <ul
            id={id}
            role="listbox"
            style={{ position: 'fixed', top: pos.top, left: pos.left, width: Math.max(pos.width, 96) }}
            className="z-[60] max-h-64 overflow-y-auto rounded-lg border border-border bg-surface py-1 shadow-lg"
          >
            {GRADE_LETTERS.map((letter) => (
              <li key={letter}>
                <button
                  type="button"
                  role="option"
                  aria-selected={value.trim().toUpperCase() === letter}
                  onClick={() => {
                    onChange(letter)
                    setOpen(false)
                    inputRef.current?.focus()
                  }}
                  className={cn(
                    'flex w-full items-center justify-between px-3 py-1.5 text-left text-[13px] transition-colors duration-150 hover:bg-surface-2',
                    value.trim().toUpperCase() === letter ? 'text-accent' : 'text-fg',
                  )}
                >
                  {letter}
                  <span className="text-[11px] text-subtle tabular-nums">
                    {percentToGrade(parseFinalGrade(letter) ?? 0).points.toFixed(1)}
                  </span>
                </button>
              </li>
            ))}
          </ul>,
          document.body,
        )}
    </div>
  )
}
