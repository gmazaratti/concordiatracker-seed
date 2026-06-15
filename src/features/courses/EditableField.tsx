import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/cn'

/** Inline text edit: reads as plain text until clicked, then becomes an input
 * that commits on blur / Enter and cancels on Escape. The course-detail panel's
 * editing primitive — keeps every logistics field a one-click change. */
export function EditableField({
  value,
  onCommit,
  ariaLabel,
  placeholder,
  className,
}: {
  value: string
  onCommit: (value: string) => void
  ariaLabel: string
  placeholder?: string
  className?: string
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) inputRef.current?.select()
  }, [editing])

  const commit = () => {
    const next = draft.trim()
    if (next !== value.trim()) onCommit(next)
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        aria-label={ariaLabel}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            commit()
          } else if (e.key === 'Escape') {
            e.preventDefault()
            setDraft(value)
            setEditing(false)
          }
        }}
        className={cn(
          'w-full rounded-md border border-accent bg-surface-2 px-1.5 py-0.5 text-[13px] text-fg focus-visible:outline-none',
          className,
        )}
      />
    )
  }

  return (
    <button
      type="button"
      onClick={() => {
        setDraft(value)
        setEditing(true)
      }}
      title="Click to edit"
      className={cn(
        '-mx-1.5 block w-full truncate rounded-md px-1.5 py-0.5 text-left text-[13px] text-fg transition-colors hover:bg-surface-2',
        value.trim() === '' && 'text-subtle italic',
        className,
      )}
    >
      {value.trim() === '' ? (placeholder ?? 'Add') : value}
    </button>
  )
}
