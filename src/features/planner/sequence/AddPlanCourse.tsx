import { useEffect, useState } from 'react'
import { Loader2, Plus, Search } from 'lucide-react'
import { searchCourses, type CatalogCourse } from '@/lib/catalog'
import type { PlanCourse } from '@/lib/course-plan'

/**
 * "Add a course" at the foot of a term: a button that becomes a search over
 * Concordia's calendar. Picking a result takes the calendar's own code, title
 * and credit value, so a planned course is always a real one.
 */
export function AddPlanCourse({ term, onAdd }: { term: string; onAdd: (c: PlanCourse) => void }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [rows, setRows] = useState<CatalogCourse[] | null>(null)

  useEffect(() => {
    const text = q.trim()
    let alive = true
    const id = window.setTimeout(
      () => {
        if (text.length < 2) {
          if (alive) setRows(null)
          return
        }
        void searchCourses(text, 6)
          .then((r) => alive && setRows(r))
          .catch(() => alive && setRows([]))
      },
      text.length < 2 ? 0 : 220,
    )
    return () => {
      alive = false
      window.clearTimeout(id)
    }
  }, [q])

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border-strong py-2.5 text-[13px] font-medium text-muted transition-colors duration-150 hover:border-accent hover:text-fg"
      >
        <Plus size={14} aria-hidden /> Add a course
      </button>
    )
  }

  const searching = q.trim().length >= 2 && rows === null
  return (
    <div>
      <div className="relative">
        <Search size={14} aria-hidden className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-subtle" />
        <input
          autoFocus
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setRows(null)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setOpen(false)
              setQ('')
            }
          }}
          placeholder="Course code or name"
          aria-label={`Find a course for ${term}`}
          className="w-full rounded-xl border border-border bg-canvas py-2.5 pr-8 pl-9 text-[13px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none"
        />
        {searching && <Loader2 size={14} aria-hidden className="absolute top-1/2 right-3 -translate-y-1/2 animate-spin text-subtle" />}
      </div>
      {rows !== null && (
        <ul className="mt-1.5 overflow-hidden rounded-xl border border-border bg-canvas">
          {rows.length === 0 && <li className="px-3 py-2.5 text-[12.5px] text-subtle">No course matches that.</li>}
          {rows.map((r) => (
            <li key={r.id} className="border-b border-border/60 last:border-b-0">
              <button
                type="button"
                onClick={() => {
                  onAdd({ code: `${r.subject} ${r.catalog}`, title: r.title, credits: r.class_unit ?? 3 })
                  setQ('')
                  setRows(null)
                  setOpen(false)
                }}
                className="flex w-full items-baseline gap-2 px-3 py-2 text-left transition-colors duration-150 hover:bg-surface-2"
              >
                <span className="shrink-0 text-[13px] font-semibold text-fg">
                  {r.subject} {r.catalog}
                </span>
                <span className="min-w-0 flex-1 truncate text-[12.5px] text-subtle">{r.title}</span>
                {r.class_unit ? <span className="shrink-0 text-[11.5px] text-subtle tabular-nums">{r.class_unit} cr</span> : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
