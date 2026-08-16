import { useEffect, useState } from 'react'
import { Loader2, Plus, Search } from 'lucide-react'
import { useAppData } from '@/app/providers/app-data'
import { Select } from '@/components/ui/Select'
import { searchCourses, type CatalogCourse } from '@/lib/catalog'
import { parseFinalGrade } from '@/lib/gpa'
import { GradeField } from '@/components/ui/GradeField'
import { pastTerms } from './past-terms'

/**
 * Add a finished course, fast.
 *
 * Someone rebuilding three years of history will do this fifteen times, so the
 * form stays put and the fields that can be inferred are: picking from the
 * catalogue fills the code, title and credits, which is three fewer things to
 * type and three fewer things to get wrong. Only the term is unavoidable, and
 * it stays selected between adds because a semester is entered in one go.
 */
export function PastCourseEntry() {
  const { addPastCourse } = useAppData()
  const [q, setQ] = useState('')
  const [results, setResults] = useState<CatalogCourse[] | null>(null)
  const [chosen, setChosen] = useState<CatalogCourse | null>(null)
  const [term, setTerm] = useState(pastTerms()[1] ?? pastTerms()[0])
  const [grade, setGrade] = useState('')
  const [busy, setBusy] = useState(false)

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
  const canAdd = chosen !== null && gradeOk && !busy

  async function add() {
    if (!chosen || !gradeOk) return
    setBusy(true)
    await addPastCourse({
      code: `${chosen.subject} ${chosen.catalog}`,
      title: chosen.title,
      term,
      credits: chosen.class_unit ?? 3,
      ...(percent === null ? {} : { finalPercent: percent }),
    })
    setBusy(false)
    setChosen(null)
    setQ('')
    setGrade('')
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <div className="grid items-stretch gap-2 sm:grid-cols-[minmax(0,1fr)_160px_112px_auto]">
        <div className="relative">
          <Search
            size={15}
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-subtle"
          />
          <input
            value={chosen ? `${chosen.subject} ${chosen.catalog} · ${chosen.title}` : q}
            onChange={(e) => {
              setChosen(null)
              setQ(e.target.value)
              // Stale hits must not linger under a changed query; cleared here
              // rather than in the effect, where it would cascade a render.
              if (!e.target.value.trim()) setResults(null)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && canAdd) void add()
            }}
            placeholder="Find a course you took"
            aria-label="Find a course you took"
            className="w-full rounded-lg border border-border bg-canvas py-2 pr-3 pl-9 text-[13.5px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none"
          />
        </div>

        <Select
          value={term}
          onChange={setTerm}
          ariaLabel="Term taken"
          options={pastTerms().map((t) => ({ value: t, label: t }))}
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
          Add
        </button>
      </div>

      {!gradeOk && (
        <p className="mt-1.5 text-[11.5px] text-danger">Enter a percentage (0 to 100) or a letter like A-, or leave it blank.</p>
      )}

      {results !== null && results.length > 0 && (
        <ul className="mt-2 max-h-52 divide-y divide-border overflow-y-auto rounded-lg border border-border">
          {results.map((c) => (
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
                {c.class_unit !== null && (
                  <span className="shrink-0 text-[11.5px] text-subtle tabular-nums">
                    {c.class_unit} cr
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {results !== null && results.length === 0 && (
        <p className="mt-2 px-1 text-[12px] text-subtle">No course matches that.</p>
      )}
    </div>
  )
}
