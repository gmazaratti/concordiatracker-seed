import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Loader2, PlusCircle, Search } from 'lucide-react'
import { ModalShell } from '@/command/ModalShell'
import { Select } from '@/components/ui/Select'
import { CourseSkeleton } from '@/components/ui/Skeleton'
import { useAppData } from '@/app/providers/app-data'
import { searchCourses, type CatalogCourse } from '@/lib/catalog'
import { laterTerms } from '@/features/planner/past-terms'
import { fileDataReport } from '@/lib/data-reports'
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
  // Strictly after the term we are in. The old filter removed the current term
  // by NAME, which left the earlier terms of the same calendar year in the list
  // — so in August you could file a class under a Winter that ended in April.
  const terms = laterTerms(6)

  const [term, setTerm] = useState(terms[0] ?? '')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<CatalogCourse[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [chosen, setChosen] = useState<CatalogCourse | null>(null)
  const [saving, setSaving] = useState(false)
  // The escape hatch. The mirror is a snapshot of the calendar, so a brand-new
  // course or one added between syncs genuinely is not in it, and "we cannot
  // find it" must never be the end of the road.
  const [manual, setManual] = useState<{ code: string; title: string; credits: string } | null>(
    null,
  )
  const [waitlisted, setWaitlisted] = useState(false)

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

  const enrollment = waitlisted ? ('waitlisted' as const) : undefined

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
      enrollment,
    })
    setSaving(false)
    // Land on the class with the section picker already open. Everything
    // Concordia publishes about it — times, room, mode, section — is one step
    // away, and making that step the default is the difference between a
    // schedule that fills itself and one nobody ever gets round to typing.
    if (id) navigate(`/app/courses/${id}`, { state: { autofill: true } })
  }

  /** Add a course the calendar does not have, and tell us it is missing. */
  async function addManual() {
    if (!manual || !term || saving) return
    const code = manual.code.trim().toUpperCase()
    if (!code) return
    setSaving(true)
    const credits = Number(manual.credits)
    const id = await createCourse({
      code,
      title: manual.title.trim(),
      credits: Number.isFinite(credits) && credits > 0 ? credits : 3,
      term,
      enrollment,
    })
    // Filed alongside, never instead of. The student is not blocked on us
    // fixing the mirror, and we still learn what it is missing.
    void fileDataReport({
      kind: 'missing_course',
      courseCode: code,
      note: manual.title.trim() || undefined,
      payload: { term, credits: manual.credits, searched: q },
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

        {manual ? (
          <div className="mt-3 space-y-2.5 rounded-lg border border-border bg-surface-2 px-3 py-3">
            <p className="text-[12px] leading-relaxed text-subtle">
              Fill in what your portal says. It goes in as a normal class straight away, and it
              also tells us what the calendar is missing so we can add it properly.
            </p>
            <div className="flex gap-2">
              <label className="min-w-0 flex-1">
                <span className="mb-1 block text-[11px] text-subtle">Course code</span>
                <input
                  value={manual.code}
                  onChange={(e) => setManual({ ...manual, code: e.target.value })}
                  placeholder="COMP 248"
                  autoFocus
                  className="w-full rounded-lg border border-border bg-canvas px-3 py-2 text-[13px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none"
                />
              </label>
              <label className="w-24 shrink-0">
                <span className="mb-1 block text-[11px] text-subtle">Credits</span>
                <input
                  value={manual.credits}
                  onChange={(e) => setManual({ ...manual, credits: e.target.value })}
                  inputMode="decimal"
                  placeholder="3"
                  className="w-full rounded-lg border border-border bg-canvas px-3 py-2 text-[13px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none"
                />
              </label>
            </div>
            <label className="block">
              <span className="mb-1 block text-[11px] text-subtle">Course name</span>
              <input
                value={manual.title}
                onChange={(e) => setManual({ ...manual, title: e.target.value })}
                placeholder="Object-Oriented Programming I"
                className="w-full rounded-lg border border-border bg-canvas px-3 py-2 text-[13px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none"
              />
            </label>
            <button
              type="button"
              onClick={() => setManual(null)}
              className="text-[11.5px] text-subtle transition-colors duration-150 hover:text-fg"
            >
              Search the calendar instead
            </button>
          </div>
        ) : chosen ? (
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
            <button
              type="button"
              onClick={() =>
                setManual({ code: q.toUpperCase(), title: '', credits: '3' })
              }
              className="mt-2 inline-flex items-center gap-1.5 text-[12px] text-subtle transition-colors duration-150 hover:text-accent"
            >
              <PlusCircle size={12} aria-hidden />
              My course isn&rsquo;t here — add it myself
            </button>
          </>
        )}

        {/* Registration is not the same as being in the class. Asked here rather
            than left to be corrected later, because a waitlisted class is one
            whose credits may never count and this is the moment you know. */}
        <label className="mt-3 flex cursor-pointer items-start gap-2.5">
          <input
            type="checkbox"
            checked={waitlisted}
            onChange={(e) => setWaitlisted(e.target.checked)}
            className="mt-0.5 size-4 shrink-0 accent-[var(--ct-accent)]"
          />
          <span className="text-[12.5px] leading-relaxed text-muted">
            I&rsquo;m on the waitlist for this one
            <span className="block text-[11.5px] text-subtle">
              Marked as a maybe, so its credits don&rsquo;t get counted as certain.
            </span>
          </span>
        </label>

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
            onClick={() => void (manual ? addManual() : add())}
            disabled={(manual ? !manual.code.trim() : !chosen) || !term || saving}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-[13px] font-medium text-accent-contrast transition-colors duration-150 hover:bg-accent-hover',
              ((manual ? !manual.code.trim() : !chosen) || saving) &&
                'cursor-not-allowed opacity-50',
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
