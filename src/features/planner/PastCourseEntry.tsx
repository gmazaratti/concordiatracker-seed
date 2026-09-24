import { useEffect, useMemo, useState } from 'react'
import { Loader2, Plus, Search, X } from 'lucide-react'
import { useAppData } from '@/app/providers/app-data'
import { Select } from '@/components/ui/Select'
import { searchCourses, type CatalogCourse } from '@/lib/catalog'
import { isNotation, parseFinalGrade, percentToGrade } from '@/lib/gpa'
import { GradeField } from '@/components/ui/GradeField'
import { courseKey, findSameCourse, otherAttempts } from '@/lib/course-match'
import { allTerms, isUpcomingTerm, pastTerms } from './past-terms'

/**
 * Add a finished course, fast.
 *
 * Someone rebuilding three years of history will do this fifteen times, so the
 * form stays put and the fields that can be inferred are: picking from the
 * catalogue fills the code, title and credits, which is three fewer things to
 * type and three fewer things to get wrong. Only the term is unavoidable, and
 * it stays selected between adds because a semester is entered in one go.
 *
 * THE CHOSEN COURSE IS A CHIP, NOT TEXT IN THE SEARCH BOX. It used to be the
 * box's value, so anything that fired an input event on that box — a stray
 * keystroke, a phone committing autocorrect as focus moved to the grade —
 * silently un-chose the course while the text still looked chosen. A chip can
 * only be cleared by its own X.
 */
export function PastCourseEntry() {
  const { addPastCourse, courses, pastCourses } = useAppData()
  const [q, setQ] = useState('')
  const [results, setResults] = useState<CatalogCourse[] | null>(null)
  const [chosen, setChosen] = useState<CatalogCourse | null>(null)
  // The newest FINISHED term: this form is for history, and defaulting to the
  // upcoming term filed a completed course beside the classes you are taking.
  const [term, setTerm] = useState(
    () => pastTerms().find((t) => !isUpcomingTerm(t)) ?? allTerms()[0],
  )
  const [grade, setGrade] = useState('')
  const [busy, setBusy] = useState(false)

  const everything = useMemo(() => [...courses, ...pastCourses], [courses, pastCourses])

  useEffect(() => {
    const needle = q.trim()
    if (chosen || !needle) return
    let alive = true
    const id = window.setTimeout(() => {
      void searchCourses(needle, 8)
        .then((r) => {
          if (alive) setResults(r)
        })
        .catch(() => {
          if (alive) setResults([])
        })
    }, 220)
    return () => {
      alive = false
      window.clearTimeout(id)
    }
  }, [q, chosen])

  // Blank is valid and means ungraded. Anything else must read as a percentage
  // or a letter on Concordia's scale; nonsense blocks the add rather than being
  // silently stored.
  const percent = parseFinalGrade(grade)
  const gradeOk = grade.trim() === '' || percent !== null

  const code = chosen ? `${chosen.subject} ${chosen.catalog}` : ''
  // Already on record for this term: the add would repeat it. With a grade the
  // record lacks, the add fills that grade in instead — a useful thing to do,
  // and exactly what the provider does with it.
  const same = chosen ? findSameCourse(everything, code, term) : undefined
  const fillsGrade = !!same && same.finalPercent == null && percent !== null
  const blockedAsDuplicate = !!same && !fillsGrade
  const retakes = chosen && !same ? otherAttempts(everything, code, term) : []

  const canAdd = chosen !== null && gradeOk && !busy && !blockedAsDuplicate

  async function add() {
    if (!chosen || !gradeOk || blockedAsDuplicate) return
    setBusy(true)
    await addPastCourse({
      code,
      title: chosen.title,
      term,
      credits: chosen.class_unit ?? 3,
      archived: !isUpcomingTerm(term),
      ...(percent === null
        ? {}
        : {
            finalPercent: percent,
            // FNS is worth 0.00 like F but is not F, and a transcript says so.
            finalLetter: isNotation(grade) ? grade.trim().toUpperCase() : percentToGrade(percent).letter,
          }),
    })
    setBusy(false)
    setChosen(null)
    setQ('')
    setGrade('')
  }

  function clearChoice() {
    setChosen(null)
    setQ('')
    setResults(null)
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <div className="grid items-stretch gap-2 sm:grid-cols-[minmax(0,1fr)_160px_112px_auto]">
        {chosen ? (
          <div className="flex min-w-0 items-center gap-2 rounded-lg border border-accent/50 bg-accent-soft py-1.5 pr-1.5 pl-3">
            <span className="shrink-0 text-[13px] font-semibold text-fg">{code}</span>
            <span className="min-w-0 flex-1 truncate text-[12.5px] text-muted">{chosen.title}</span>
            <button
              type="button"
              onClick={clearChoice}
              aria-label={`Choose a different course than ${code}`}
              className="grid size-7 shrink-0 place-items-center rounded-md text-subtle transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
            >
              <X size={14} aria-hidden />
            </button>
          </div>
        ) : (
          <div className="relative">
            <Search
              size={15}
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-subtle"
            />
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value)
                // Stale hits must not linger under a changed query; cleared here
                // rather than in the effect, where it would cascade a render.
                if (!e.target.value.trim()) setResults(null)
              }}
              placeholder="Find a course you took"
              aria-label="Find a course you took"
              className="w-full rounded-lg border border-border bg-canvas py-2 pr-3 pl-9 text-[13.5px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none"
            />
          </div>
        )}

        <Select
          value={term}
          onChange={setTerm}
          ariaLabel="Term taken"
          options={allTerms().map((t) => ({
            value: t,
            label: isUpcomingTerm(t) ? `${t} · upcoming` : t,
          }))}
        />

        <GradeField
          value={grade}
          onChange={setGrade}
          ariaLabel="Final grade, percentage or letter, optional"
          placeholder="Grade or A-"
        />

        <button
          type="button"
          onClick={() => void add()}
          disabled={!canAdd}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-[13px] font-medium whitespace-nowrap text-accent-contrast transition-colors duration-150 hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Plus size={14} aria-hidden />}
          {fillsGrade ? 'Add grade' : 'Add'}
        </button>
      </div>

      {!gradeOk && (
        <p className="mt-1.5 text-[11.5px] text-danger">Enter a percentage (0 to 100) or a letter like A-, or leave it blank.</p>
      )}
      {chosen && same && (
        <p className="mt-1.5 text-[11.5px] text-muted" role="status">
          {fillsGrade
            ? `${code} is already on your record for ${term} without a grade: this adds the grade to it.`
            : `${code} is already on your record for ${term}. Change its grade from the list below.`}
        </p>
      )}
      {retakes.length > 0 && (
        <p className="mt-1.5 text-[11.5px] text-muted">
          You also have {code} in {retakes.map((r) => r.term).join(', ')}. Adding it again counts as a
          retake, and only the latest attempt counts toward your GPA.
        </p>
      )}

      {!chosen && results !== null && results.length > 0 && (
        <ul className="mt-2 max-h-52 divide-y divide-border overflow-y-auto rounded-lg border border-border">
          {results.map((c) => {
            const held = everything.filter((x) => courseKey(x.code) === courseKey(`${c.subject}${c.catalog}`))
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => {
                    setChosen(c)
                    setResults(null)
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors duration-150 hover:bg-surface-2"
                >
                  <span className="shrink-0 text-[12.5px] font-semibold text-fg">
                    {c.subject} {c.catalog}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[12px] text-subtle">{c.title}</span>
                  {held.length > 0 && (
                    <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-[10.5px] text-muted">
                      Added · {held[0].term}
                    </span>
                  )}
                  {c.class_unit !== null && (
                    <span className="shrink-0 text-[11.5px] text-subtle tabular-nums">
                      {c.class_unit} cr
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {!chosen && results !== null && results.length === 0 && (
        <p className="mt-2 px-1 text-[12px] text-subtle">No course matches that.</p>
      )}
    </div>
  )
}
