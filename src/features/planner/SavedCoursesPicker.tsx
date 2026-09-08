import { useEffect, useState } from 'react'
import { Bookmark, Loader2 } from 'lucide-react'
import { ModalShell } from '@/command/ModalShell'
import { Mascot } from '@/components/Mascot'
import { listSaved, type SavedCourse } from '@/lib/saved-courses'
import { cn } from '@/lib/cn'

/**
 * Your shortlist, reachable from inside the builder.
 *
 * The Saved tab already holds the courses you are weighing up, but getting to
 * it meant leaving a half-built week — and the moment you most want that list is
 * while you are filling the week. So it opens here instead, and picking one
 * drops its code into the search rather than adding a section outright: which
 * SECTION you want is still yours to choose, and we have no business putting
 * someone in an 8am at Loyola.
 */
export function SavedCoursesButton({ onPick }: { onPick: (code: string) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Courses you have shortlisted in Saved"
        className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2 py-1.5 text-[11.5px] font-medium text-muted transition-colors duration-150 hover:border-accent hover:text-fg"
      >
        <Bookmark size={12} aria-hidden />
        Saved
      </button>
      {open && (
        <SavedCoursesModal
          onClose={() => setOpen(false)}
          onPick={(code) => {
            onPick(code)
            setOpen(false)
          }}
        />
      )}
    </>
  )
}

function SavedCoursesModal({
  onPick,
  onClose,
}: {
  onPick: (code: string) => void
  onClose: () => void
}) {
  const [rows, setRows] = useState<SavedCourse[] | null>(null)

  useEffect(() => {
    let alive = true
    void listSaved().then((r) => alive && setRows(r))
    return () => {
      alive = false
    }
  }, [])

  return (
    <ModalShell label="Saved courses" onClose={onClose} widthClass="sm:max-w-sm">
      <div className="p-4 sm:p-5">
        <h2 className="font-display text-[17px] font-medium text-fg">Saved courses</h2>
        <p className="mt-1 text-[12.5px] leading-relaxed text-subtle">
          Pick one to search its sections for this term. Nothing is added until you choose a
          section.
        </p>

        {rows === null && (
          <p className="mt-4 flex items-center gap-2 text-[12.5px] text-subtle">
            <Loader2 size={14} className="animate-spin" aria-hidden />
            Loading your shortlist…
          </p>
        )}

        {rows?.length === 0 && (
          <div className="mt-4 flex flex-col items-center gap-2 rounded-lg border border-dashed border-border px-4 py-6 text-center">
            {/* Nothing is wrong here — it is an empty shortlist, not a failure. */}
            <Mascot mood="resting" size="sm" soft className="text-accent" />
            <p className="text-[12.5px] font-medium text-fg">Nothing saved yet</p>
            <p className="max-w-[16rem] text-[11.5px] leading-relaxed text-subtle">
              Star a course in the Directory and it lands here, with your note and the term you
              meant to take it in.
            </p>
          </div>
        )}

        {rows && rows.length > 0 && (
          <ul className="mt-4 max-h-[46vh] divide-y divide-border overflow-y-auto rounded-lg border border-border">
            {rows.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => onPick(r.code)}
                  className={cn(
                    'block w-full px-3 py-2.5 text-left transition-colors duration-150',
                    'hover:bg-surface-2',
                  )}
                >
                  <span className="flex items-baseline gap-2">
                    <span className="text-[12.5px] font-semibold text-fg">{r.code}</span>
                    {r.planned_term && (
                      <span className="shrink-0 rounded bg-surface-2 px-1.5 py-0.5 text-[10.5px] text-subtle">
                        {r.planned_term}
                      </span>
                    )}
                  </span>
                  {r.title && (
                    <span className="mt-0.5 block truncate text-[11.5px] text-subtle">
                      {r.title}
                    </span>
                  )}
                  {r.note && (
                    <span className="mt-0.5 block truncate text-[11px] text-muted italic">
                      {r.note}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </ModalShell>
  )
}
