import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link2 } from 'lucide-react'
import { insertLink, normaliseHref } from '@/lib/bio-links'
import { cn } from '@/lib/cn'

/**
 * A bio textarea that can make a link out of a selection.
 *
 * TWO WAYS IN, because the two platforms disagree about what a selection
 * offers. On a desktop, right-clicking a selection is where people look for
 * "turn this into a link", so there is a small menu there. On a phone there is
 * no right click and the long-press menu belongs to the OS, so the toolbar
 * button above the field is the affordance — and it is always visible rather
 * than appearing on selection, because a control that materialises under your
 * thumb is one you press by accident.
 *
 * THE CARET IS PUT BACK. Inserting markup and leaving the caret at the end of
 * the field means finding your place again on every link, which is the reason
 * people stop using a feature like this after the second one.
 *
 * IT EDITS TEXT, NOT A DOCUMENT. The value stays the plain string the column
 * holds — see bio-links.ts for why that is the format — so nothing here has to
 * know about selection ranges inside rendered HTML.
 */
export function BioField({
  value,
  onChange,
  placeholder,
  rows = 4,
  maxLength = 300,
  label,
  className,
}: {
  value: string
  onChange: (next: string) => void
  placeholder?: string
  rows?: number
  maxLength?: number
  label?: string
  className?: string
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const [asking, setAsking] = useState<{ start: number; end: number; selected: string } | null>(
    null,
  )
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)

  const openPrompt = () => {
    const el = ref.current
    if (!el) return
    setMenu(null)
    const start = el.selectionStart ?? 0
    const end = el.selectionEnd ?? 0
    setAsking({ start, end, selected: value.slice(start, end) })
  }

  const apply = (href: string) => {
    if (!asking) return
    const next = insertLink(value, asking.start, asking.end, href)
    onChange(next.value)
    setAsking(null)
    // After the value lands, or the caret is placed in the old string.
    requestAnimationFrame(() => {
      const el = ref.current
      if (!el) return
      el.focus()
      el.setSelectionRange(next.caret, next.caret)
    })
  }

  return (
    <div className={className}>
      <div className="mb-1 flex items-center justify-between gap-2">
        {label && <span className="text-[12px] font-medium text-subtle">{label}</span>}
        <button
          type="button"
          onClick={openPrompt}
          className="ml-auto inline-flex items-center gap-1 rounded-lg px-1.5 py-1 text-[12px] font-medium text-accent transition-colors duration-150 hover:bg-surface-2"
        >
          <Link2 size={13} aria-hidden />
          Add hyperlink
        </button>
      </div>
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onContextMenu={(e) => {
          const el = ref.current
          if (!el || el.selectionStart === el.selectionEnd) return
          e.preventDefault()
          setMenu({ x: e.clientX, y: e.clientY })
        }}
        rows={rows}
        maxLength={maxLength}
        placeholder={placeholder}
        className="w-full resize-none rounded-xl border border-border bg-canvas px-3 py-2.5 text-[13.5px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none"
      />

      {menu &&
        createPortal(
          <>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => setMenu(null)}
              className="fixed inset-0 z-[80] cursor-default"
            />
            <div
              role="menu"
              style={{ left: Math.min(menu.x, window.innerWidth - 180), top: menu.y }}
              className="fixed z-[81] rounded-xl border border-border bg-surface p-1 shadow-2xl"
            >
              <button
                type="button"
                role="menuitem"
                onClick={openPrompt}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
              >
                <Link2 size={14} aria-hidden />
                Add hyperlink
              </button>
            </div>
          </>,
          document.body,
        )}

      {asking && (
        <LinkPrompt
          selected={asking.selected}
          onCancel={() => setAsking(null)}
          onSubmit={apply}
        />
      )}
    </div>
  )
}

function LinkPrompt({
  selected,
  onCancel,
  onSubmit,
}: {
  selected: string
  onCancel: () => void
  onSubmit: (href: string) => void
}) {
  const [url, setUrl] = useState('')
  const href = normaliseHref(url)
  const bad = url.trim().length > 0 && !href

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/55 p-4">
      <button type="button" aria-label="Cancel" onClick={onCancel} className="absolute inset-0" />
      <div className="relative w-full max-w-xs rounded-2xl border border-border bg-surface p-4 shadow-2xl">
        <h3 className="text-[14.5px] font-semibold text-fg">Add a hyperlink</h3>
        <p className="mt-0.5 text-[12px] text-subtle">
          {selected.trim() ? (
            <>
              <span className="text-fg">{selected.trim().slice(0, 40)}</span> will link to it.
            </>
          ) : (
            'Nothing is selected, so the word "link" is used.'
          )}
        </p>
        <input
          autoFocus
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && href) onSubmit(href)
            if (e.key === 'Escape') onCancel()
          }}
          inputMode="url"
          placeholder="linktr.ee/yourclub"
          className="mt-3 w-full rounded-lg border border-border bg-canvas px-3 py-2 text-[13.5px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none"
        />
        {bad ? (
          <p className="mt-1.5 text-[11.5px] text-warning">
            That is not a web address. Only http and https links can be added.
          </p>
        ) : (
          href && (
            <p className="mt-1.5 truncate text-[11.5px] text-subtle">Opens {href}</p>
          )
        )}
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className={cn(
              'flex-1 rounded-full border border-border py-2 text-[13px] font-medium text-muted',
              'transition-colors duration-150 hover:bg-surface-2 hover:text-fg',
            )}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => href && onSubmit(href)}
            disabled={!href}
            className="flex-1 rounded-full bg-accent py-2 text-[13px] font-semibold text-accent-contrast disabled:opacity-60"
          >
            Add
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
