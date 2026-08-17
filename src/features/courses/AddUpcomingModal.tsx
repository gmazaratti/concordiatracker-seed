import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Loader2, Search } from 'lucide-react'
import { ModalShell } from '@/command/ModalShell'
import { Select } from '@/components/ui/Select'
import { CourseSkeleton } from '@/components/ui/Skeleton'
import { useAppData } from '@/app/providers/app-data'
import { searchCourses, type CatalogCourse } from '@/lib/catalog'
import { futureTerms, currentTermName } from '@/features/planner/past-terms'
import { cn } from '@/lib/cn'

/**
 * Add a class you are registered in for a term that has not started.
 *
 * Picked from the calendar rather than typed. We mirror all 7,884 courses with
 * their real codes, titles and credit values, so asking someone to retype
 * "COMM 217" is asking them to introduce a typo we then carry forever — and
 * getting the credit count wrong quietly breaks the full-time check, the
 * tuition estimate and the degree audit at once.
 *
 * What it deliberately does NOT do is offer to import an outline. See the note
 * on the confirm step.
 */
export function AddUpcomingModal({ onClose }: { onClose: () => void }) {
  const { createCourse } = useAppData()
  const navigate = useNavigate()
  const terms = futureTerms(6).filter((t) => t !== currentTermName())

  const [term, setTerm] = useState(terms[0] ?? '')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<CatalogCourse[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [chosen, setChosen] = useState<CatalogCourse | null>(null)
  const [saving, setSaving] = useState(false)

  const q = query.trim()
  const canSearch = q.length >= 2 && !chosen

  useEffect(() => {
    if (!canSearch) return
    let alive = true
    const id = window.setTimeout(() => {
      setSearching(true)
      void searchCourses(q, 25)
        .then((rows) => alive && setResults(rows))
        .catch(() => alive && setResults([]))
        .finally(() => alive && setSearching(false))
    }, 220)
    return () => {
      alive = false
      window.clearTimeout(id)
    }
  }, [q, canSearch])

  async function add() {
    if (!chosen || !term || saving) return
    setSaving(true)
    const id = await createCourse({
      code: `${chosen.subject} ${chosen.catalog}`,
      title: chosen.title,
      // The calendar's own credit value, not an assumed 3. COMP 248 is 3.5, and
      // guessing it wrong throws off everything downstream that counts credits.
      credits: chosen.class_unit ?? 3,
      term,
    })
    setSaving(false)
    if (id) navigate(`/app/courses/${id}`)
  }

  return (
    <ModalShell label="Add a class for a later term" onClose={onClose} widthClass="sm:max-w-lg">
      <div className="p-4 sm:p-5">
        <h2 className="font-display text-[18px] font-semibold text-fg">Add a class</h2>
        <p className="mt-1 text-[12.5px] leading-relaxed text-subtle">
          For a term you have not started yet. Pick it from Concordia&rsquo;s calendar so the code,
          title and credits are right from the start.
        </p>

        <label className="mt-4 block">
          <span className="mb-1 block text-[11.5px] text-subtle">Term</span>
          <Select
            value={term}
            onChange={setTerm}
            ariaLabel="Term"
            options={terms.map((t) => ({ value: t, label: t }))}
          />
        </label>

        {chosen ? (
          <div className="mt-3 rounded-lg border border-accent bg-accent-soft/40 px-3 py-2.5">
            <div className="flex items-start gap-2">
              <Check size={14} className="mt-0.5 shrink-0 text-accent" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-fg">
                  {chosen.subject} {chosen.catalog}
                  <span className="ml-1.5 font-normal text-subtle">
                    {chosen.class_unit ?? 3} credits
                  </span>
                </p>
                <p className="truncate text-[12px] text-muted">{chosen.title}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setChosen(null)
                  setResults(null)
                  setQuery('')
                }}
                className="shrink-0 text-[11.5px] text-subtle transition-colors duration-150 hover:text-fg"
              >
                Change
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="relative mt-3">
              <Search
                size={15}
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-subtle"
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Course code or name — e.g. COMM 217, or “accounting”"
                aria-label="Find a course"
                autoFocus
                className="w-full rounded-lg border border-border bg-canvas py-2.5 pr-9 pl-9 text-[13px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none"
              />
              {searching && (
                <Loader2
                  size={14}
                  className="absolute top-1/2 right-3 -translate-y-1/2 animate-spin text-subtle"
                  aria-hidden
                />
              )}
            </div>

            {canSearch && results === null && searching && (
              <div className="mt-2">
                <CourseSkeleton rows={3} />
              </div>
            )}

            {results !== null && (
              <ul className="mt-2 max-h-[38vh] divide-y divide-border overflow-y-auto rounded-lg border border-border">
                {results.length === 0 ? (
                  <li className="px-3 py-3 text-[12.5px] text-subtle">
                    Nothing in the calendar matches that.
                  </li>
                ) : (
                  results.map((c) => (
                    <li key={c.id || `${c.subject}${c.catalog}`}>
                      <button
                        type="button"
                        onClick={() => setChosen(c)}
                        className="w-full px-3 py-2 text-left transition-colors duration-150 hover:bg-surface-2"
                      >
                        <span className="flex items-baseline gap-2">
                          <span className="text-[12.5px] font-semibold text-fg">
                            {c.subject} {c.catalog}
                          </span>
                          <span className="text-[11px] text-subtle">
                            {c.class_unit ?? 3} credits
                          </span>
                        </span>
                        <span className="block truncate text-[11.5px] text-muted">{c.title}</span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            )}
          </>
        )}

        {/* The honest bit. A blueprint for a course you take next term carries
            LAST term's dates, which is worse than having none — you would plan
            around a midterm that is not there. So no outline is offered here at
            all; the course detail has a quiet way in for the rare student who
            genuinely has the syllabus early. */}
        <p className="mt-3 rounded-lg border border-border bg-canvas px-3 py-2 text-[11.5px] leading-relaxed text-subtle">
          No assignments or dates get added. Outlines are published in the first week of term, and
          last term&rsquo;s dates would be wrong in a way you would plan around.
        </p>

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-3 py-2 text-[13px] text-muted transition-colors duration-150 hover:text-fg"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void add()}
            disabled={!chosen || !term || saving}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-[13px] font-medium text-accent-contrast transition-colors duration-150 hover:bg-accent-hover',
              (!chosen || saving) && 'cursor-not-allowed opacity-50',
            )}
          >
            {saving && <Loader2 size={14} className="animate-spin" aria-hidden />}
            Add to {term}
          </button>
        </div>
      </div>
    </ModalShell>
  )
}
