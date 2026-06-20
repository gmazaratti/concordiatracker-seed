import { useId, useRef, useState } from 'react'
import { Check, ChevronLeft, Search, X } from 'lucide-react'
import { OTHER_PROGRAM_ID, programById, searchPrograms, type Program } from '@/data/programs'
import { cn } from '@/lib/cn'

export interface ProgramSelection {
  /** Canonical program id, or 'other'. */
  id: string
  /** Display name (the program name, or the free-text for 'other'). */
  name: string
}

/**
 * Searchable program picker (typeahead combobox) over the canonical Concordia
 * program registry — NOT a giant scroll list. Type to filter; pick a result, or
 * choose "Other" and free-type so no one is ever blocked. Selection is the
 * structured `{ id, name }` (id is the canonical value the caller stores).
 */
export function ProgramPicker({
  value,
  onChange,
  autoFocus,
  size = 'lg',
}: {
  value: ProgramSelection | null
  onChange: (sel: ProgramSelection) => void
  autoFocus?: boolean
  size?: 'lg' | 'sm'
}) {
  const listId = useId()
  const [editing, setEditing] = useState(!value)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [otherMode, setOtherMode] = useState(false)
  const [otherText, setOtherText] = useState(value?.id === OTHER_PROGRAM_ID ? value.name : '')
  const inputRef = useRef<HTMLInputElement>(null)

  const lg = size === 'lg'
  const results = query.trim() ? searchPrograms(query, 8) : []
  // The "Other" row is always reachable as the last option.
  const optionCount = results.length + 1
  const isOtherRow = active === results.length

  const pickProgram = (p: Program) => {
    onChange({ id: p.id, name: p.name })
    setEditing(false)
    setOtherMode(false)
  }
  const submitOther = () => {
    const t = otherText.trim()
    if (!t) return
    onChange({ id: OTHER_PROGRAM_ID, name: t })
    setEditing(false)
    setOtherMode(false)
  }

  // ---- Selected (collapsed) view -------------------------------------------
  if (!editing && value) {
    const prog = programById(value.id)
    return (
      <div className={cn('flex flex-wrap items-center gap-3', lg ? 'justify-center' : '')}>
        <span
          className={cn(
            'inline-flex items-center gap-2 rounded-xl border border-accent bg-accent-soft text-fg',
            lg ? 'px-4 py-2.5 text-[15px]' : 'px-3 py-1.5 text-[13px]',
          )}
        >
          <Check size={lg ? 16 : 14} className="text-accent" aria-hidden />
          <span className="font-medium">{value.name}</span>
          {prog && <span className="text-subtle">· {prog.credential}</span>}
          {value.id === OTHER_PROGRAM_ID && <span className="text-subtle">· Other</span>}
        </span>
        <button
          type="button"
          onClick={() => {
            setEditing(true)
            setOtherMode(false)
            setQuery('')
          }}
          className={cn('font-medium text-muted transition-colors hover:text-fg', lg ? 'text-[13px]' : 'text-[12px]')}
        >
          Change
        </button>
      </div>
    )
  }

  // ---- "Other" free-text mode ----------------------------------------------
  if (otherMode) {
    return (
      <div className={cn('mx-auto w-full', lg ? 'max-w-md text-left' : '')}>
        <button
          type="button"
          onClick={() => setOtherMode(false)}
          className="mb-2 inline-flex items-center gap-1 text-[12px] font-medium text-subtle transition-colors hover:text-fg"
        >
          <ChevronLeft size={14} aria-hidden /> Back to search
        </button>
        <label className="block text-[12px] text-muted">What are you studying?</label>
        <input
          autoFocus
          value={otherText}
          onChange={(e) => setOtherText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              submitOther()
            }
          }}
          placeholder="Your program"
          maxLength={80}
          className={cn(
            'mt-1.5 w-full rounded-xl border border-border bg-surface text-fg placeholder:text-subtle focus:border-accent focus:outline-none',
            lg ? 'px-4 py-3 text-[16px]' : 'px-3 py-2 text-[13px]',
          )}
        />
        <p className="mt-1.5 text-[12px] text-subtle">We’ll add programs we’re missing — thanks for flagging it.</p>
        <button
          type="button"
          disabled={!otherText.trim()}
          onClick={submitOther}
          className="mt-2.5 rounded-lg bg-accent px-3.5 py-1.5 text-[13px] font-medium text-accent-contrast transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          Use this
        </button>
      </div>
    )
  }

  // ---- Search mode ----------------------------------------------------------
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => Math.min(a + 1, optionCount - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (isOtherRow) setOtherMode(true)
      else if (results[active]) pickProgram(results[active])
    } else if (e.key === 'Escape' && value) {
      e.preventDefault()
      setEditing(false)
    }
  }

  return (
    <div className={cn('mx-auto w-full', lg ? 'max-w-md text-left' : '')}>
      <div
        className={cn(
          'flex items-center rounded-xl border border-border bg-surface focus-within:border-accent',
          lg ? 'px-4 py-3' : 'px-3 py-2',
        )}
      >
        <Search size={lg ? 18 : 15} className="shrink-0 text-subtle" aria-hidden />
        <input
          ref={inputRef}
          autoFocus={autoFocus}
          role="combobox"
          aria-expanded={query.trim().length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setActive(0)
          }}
          onKeyDown={onKeyDown}
          placeholder="Search your program (e.g. Psychology, Computer Science)"
          className={cn(
            'ml-2 w-full bg-transparent text-fg placeholder:text-subtle focus:outline-none',
            lg ? 'text-[16px]' : 'text-[13px]',
          )}
        />
        {query && (
          <button type="button" onClick={() => setQuery('')} aria-label="Clear" className="shrink-0 text-subtle hover:text-fg">
            <X size={lg ? 16 : 14} aria-hidden />
          </button>
        )}
      </div>

      <ul id={listId} role="listbox" className="mt-2 max-h-[46vh] space-y-1 overflow-y-auto sm:max-h-72">
        {query.trim() && results.length === 0 && (
          <li className="px-1 py-2 text-[13px] text-subtle">No match — choose “Other” below.</li>
        )}
        {results.map((p, i) => (
          <li key={p.id} role="option" aria-selected={i === active}>
            <button
              type="button"
              onMouseEnter={() => setActive(i)}
              onClick={() => pickProgram(p)}
              className={cn(
                'flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left transition-colors',
                i === active ? 'border-accent bg-accent-soft' : 'border-border bg-surface hover:border-border-strong',
              )}
            >
              <span className="min-w-0 truncate text-[14px] font-medium text-fg">{p.name}</span>
              <span className="shrink-0 text-[12px] text-subtle">{p.credential}</span>
            </button>
          </li>
        ))}

        {/* Always-present escape hatch. */}
        <li role="option" aria-selected={isOtherRow}>
          <button
            type="button"
            onMouseEnter={() => setActive(results.length)}
            onClick={() => setOtherMode(true)}
            className={cn(
              'flex w-full items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-left text-[13px] transition-colors',
              isOtherRow ? 'border-accent bg-accent-soft text-fg' : 'border-border text-muted hover:text-fg',
            )}
          >
            Can’t find your program? <span className="font-medium">Choose Other</span>
          </button>
        </li>
      </ul>
    </div>
  )
}
