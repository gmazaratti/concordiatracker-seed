/**
 * The inline "move this course to the current term?" step under a past row.
 *
 * Inline rather than a dialog: it is one course and one question, and the row
 * it belongs to stays in view. It says what will change (the term label, and
 * the final grade when that grade was typed by hand and cannot be rebuilt),
 * and refuses instead of creating a second copy of a course already live.
 */
export function MoveConfirm({
  code,
  term,
  duplicate,
  losesTypedGrade,
  onMove,
  onCancel,
}: {
  code: string
  term: string
  duplicate: boolean
  losesTypedGrade: boolean
  onMove: () => void
  onCancel: () => void
}) {
  if (duplicate) {
    return (
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface-2 px-3 py-2 text-[12px] text-muted">
        <span>{code} is already in {term}, so there is nothing to move.</span>
        <button type="button" onClick={onCancel} className="font-medium text-fg hover:underline">
          OK
        </button>
      </div>
    )
  }
  return (
    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface-2 px-3 py-2">
      <p className="min-w-0 text-[12px] leading-relaxed text-muted">
        Still taking {code}? It moves to <span className="font-medium text-fg">{term}</span> and back under This term.
        {losesTypedGrade && ' The final grade you entered is cleared.'}
      </p>
      <div className="flex shrink-0 items-center gap-2">
        <button type="button" onClick={onCancel} className="rounded-md px-2 py-1 text-[12px] text-subtle hover:text-fg">
          Cancel
        </button>
        <button
          type="button"
          onClick={onMove}
          className="rounded-md bg-accent px-2.5 py-1 text-[12px] font-medium text-accent-contrast hover:bg-accent-hover"
        >
          Move to this term
        </button>
      </div>
    </div>
  )
}
