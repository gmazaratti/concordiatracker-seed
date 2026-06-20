import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, FileText, Loader2, Search, ShieldCheck } from 'lucide-react'
import { useAppData } from '@/app/providers/app-data'
import { usePrefersReducedMotion } from '@/app/hooks/usePrefersReducedMotion'
import { COMM221_PARSED, RAW_ROWS, type Phase } from '@/features/landing/parse-demo-data'
import { useAllBlueprintCourses } from '@/features/courses/useBlueprints'
import { blueprintToAssessments, netVotes, type Blueprint } from '@/data/blueprints'
import { blueprintFromRow, normalizeCode, type BlueprintRow } from '@/lib/supabase-adapters'
import { supabase } from '@/lib/supabase'
import { term } from '@/data/mock'
import { termRank } from '@/lib/term'
import { cn } from '@/lib/cn'
import type { Assessment } from '@/data/types'
import { ONBOARD_COURSES, toAssessments } from './onboarding-data'

type Mode = 'choose' | 'search' | 'pick' | 'pdf'
const DAY = 86_400_000
const BP_COLS =
  'id, user_id, course_code, course_name, professor, author, section, term, items, verified, upvotes, downvotes, imports, created_at'

interface AddedCourse {
  code: string
  count: number
  already?: boolean
}

/** Keep a blueprint unless its term is IDENTIFIABLY an older semester. Current
 * or newer terms pass; an empty/unparseable term (rank 0) is ambiguous, so we
 * keep it rather than risk hiding live outlines that just lack a term. */
const notPastTerm = (t: string) => {
  const r = termRank(t)
  return r === 0 || r >= termRank(term.name)
}

/** Shift a blueprint's dates so the earliest lands ~5 days out (upcoming). */
function rebaseUpcoming(items: Assessment[]): Assessment[] {
  if (items.length === 0) return items
  const minDue = Math.min(...items.map((a) => +new Date(a.due)))
  const offset = Date.now() + 5 * DAY - minDue
  return items.map((a) => ({ ...a, due: new Date(+new Date(a.due) + offset).toISOString() }))
}

/**
 * Multi-course onboarding import. Add as many courses as you like — search and
 * pick a SECTION (teacher-verified shows alone; otherwise community outlines
 * ranked most-credible-first), or upload a syllabus to parse. Each import joins
 * a running list; the parent's Continue proceeds once at least one is in.
 */
export function AddCourses({ onAdded }: { onAdded: () => void }) {
  const { createCourse, addAssessments, courses } = useAppData()
  const [mode, setMode] = useState<Mode>('choose')
  const [added, setAdded] = useState<AddedCourse[]>([])
  const [justAdded, setJustAdded] = useState<string | null>(null)
  const [pick, setPick] = useState<{ code: string; name: string } | null>(null)

  const enrolled = (code: string) => courses.some((c) => c.code && normalizeCode(c.code) === normalizeCode(code))

  const record = (a: AddedCourse) => {
    setAdded((prev) =>
      prev.some((p) => normalizeCode(p.code) === normalizeCode(a.code)) ? prev : [...prev, a],
    )
    setJustAdded(a.code)
    onAdded()
    setMode('choose')
  }

  const importBlueprint = async (code: string, name: string, bp: Blueprint) => {
    if (enrolled(code)) return record({ code, count: 0, already: true })
    const id = await createCourse({ code, title: name })
    if (!id) return
    const items = rebaseUpcoming(blueprintToAssessments(bp)).map((a) => ({
      ...a,
      id: crypto.randomUUID(),
      courseId: id,
    }))
    await addAssessments(items)
    record({ code, count: items.length })
  }

  const importSample = async () => {
    const c = ONBOARD_COURSES[0]
    if (enrolled(c.code)) return record({ code: c.code, count: 0, already: true })
    const id = await createCourse({ code: c.code, title: c.title })
    if (!id) return
    const items = toAssessments(c, id)
    await addAssessments(items)
    record({ code: c.code, count: items.length })
  }

  if (mode === 'pdf') {
    return (
      <div className="mx-auto w-full max-w-md">
        <BackBtn onClick={() => setMode('choose')} />
        <h2 className="mt-2 text-center font-display text-[20px] font-semibold text-fg sm:text-[26px]">Reading your syllabus…</h2>
        <PdfParse onParsed={() => void importSample()} />
      </div>
    )
  }

  if (mode === 'search') {
    return (
      <SearchCourses
        onPick={(code, name) => {
          setPick({ code, name })
          setMode('pick')
        }}
        onParseInstead={() => setMode('pdf')}
        onBack={() => setMode('choose')}
      />
    )
  }

  if (mode === 'pick' && pick) {
    return (
      <PickSection
        code={pick.code}
        name={pick.name}
        onImport={importBlueprint}
        onBack={() => setMode('search')}
        onParseInstead={() => setMode('pdf')}
      />
    )
  }

  const has = added.length > 0
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col">
      <div className="text-center">
        <h2 className="font-display text-[21px] leading-tight font-semibold text-fg sm:text-[28px]">
          {has ? 'Add another course?' : 'Add your courses'}
        </h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted sm:text-[14px]">
          {has
            ? 'Stack as many as you like — they all land on Today. Or continue when you’re set.'
            : 'Import as many as you want. Two ways in — pick whichever fits your class.'}
        </p>
      </div>

      {has && <AddedList added={added} justAdded={justAdded} />}

      <div className={cn('grid gap-3 sm:grid-cols-2', has ? 'mt-5' : 'mt-5 sm:mt-6')}>
        <ChoiceTile
          icon={Search}
          label="Find your course"
          desc="Search your class and import a ready-made outline — every deadline and weight fills in instantly."
          onClick={() => setMode('search')}
        />
        <ChoiceTile
          icon={FileText}
          label="Upload a syllabus"
          desc="Got the PDF? We scan it and lift out every deadline, weight, and grade automatically — no typing."
          onClick={() => setMode('pdf')}
        />
      </div>
    </div>
  )
}

/** The running list of courses added so far (the most recent one highlighted). */
function AddedList({ added, justAdded }: { added: AddedCourse[]; justAdded: string | null }) {
  return (
    <ul className="mt-5 space-y-2">
      {added.map((a) => (
        <li
          key={a.code}
          className={cn(
            'flex items-center gap-3 rounded-xl border px-3.5 py-2.5 transition-colors duration-300',
            a.code === justAdded ? 'border-accent bg-accent-soft' : 'border-border bg-surface',
          )}
        >
          <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-success/15 text-success">
            <Check size={16} aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="text-[13px] font-semibold text-fg">{a.code}</span>
            <span className="block text-[12px] text-subtle">
              {a.already ? 'Already on your Today' : `${a.count} deadline${a.count === 1 ? '' : 's'} added`}
            </span>
          </span>
        </li>
      ))}
    </ul>
  )
}

function SearchCourses({
  onPick,
  onParseInstead,
  onBack,
}: {
  onPick: (code: string, name: string) => void
  onParseInstead: () => void
  onBack: () => void
}) {
  const { list, loading } = useAllBlueprintCourses()
  const [q, setQ] = useState('')
  // Hide codes whose most-recent outline is an older semester.
  const current = list.filter((c) => notPastTerm(c.term))
  const needle = q.trim().toLowerCase()
  const results = needle
    ? current.filter((c) => c.code.toLowerCase().includes(needle) || c.courseName.toLowerCase().includes(needle))
    : current.slice(0, 6)

  return (
    <div className="mx-auto w-full max-w-lg">
      <BackBtn onClick={onBack} />
      <h2 className="mt-2 text-center font-display text-[21px] font-semibold text-fg sm:text-[28px]">Find your course</h2>
      <p className="mt-2 text-center text-[13px] text-muted sm:text-[14px]">Search by code or name, then pick your section.</p>

      <div className="relative mt-4 sm:mt-5">
        <Search size={16} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-subtle" aria-hidden />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="e.g. COMP 248 or Financial"
          className="w-full rounded-xl border border-border bg-surface py-2.5 pr-3 pl-10 text-[15px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none sm:py-3"
        />
      </div>

      <div className="mt-3 max-h-[38vh] space-y-2 overflow-y-auto sm:max-h-none">
        {loading ? (
          <div className="grid place-items-center py-8">
            <Loader2 className="size-5 animate-spin text-accent" aria-label="Loading" />
          </div>
        ) : results.length === 0 ? (
          <p className="rounded-xl border border-border bg-surface px-4 py-6 text-center text-[13px] text-subtle">
            No outline for that course this term.
          </p>
        ) : (
          results.map((c) => (
            <button
              key={c.code}
              type="button"
              onClick={() => onPick(c.code, c.courseName || c.code)}
              className="flex w-full items-center gap-3 rounded-xl border border-border bg-surface p-2.5 text-left transition-colors duration-150 hover:border-accent sm:p-3.5"
            >
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="text-[14px] font-semibold text-fg">{c.code}</span>
                  {c.hasVerified && <ShieldCheck size={14} className="text-accent" aria-label="Teacher-verified" />}
                </span>
                <span className="block truncate text-[12px] text-subtle">{c.courseName || 'Tap to choose a section'}</span>
              </span>
              <ArrowRight size={15} className="shrink-0 text-subtle" aria-hidden />
            </button>
          ))
        )}
      </div>

      <button
        type="button"
        onClick={onParseInstead}
        className="mt-4 inline-flex w-full items-center justify-center gap-1.5 text-[13px] font-medium text-muted transition-colors duration-150 hover:text-fg"
      >
        I don't see my course — upload a syllabus instead
        <ArrowRight size={14} aria-hidden />
      </button>
    </div>
  )
}

/** Pick a section for a code. Loads its outlines (current term only), groups by
 * section; a teacher-verified outline shows alone, otherwise community outlines
 * rank most-credible-first (net votes). */
function PickSection({
  code,
  name,
  onImport,
  onBack,
  onParseInstead,
}: {
  code: string
  name: string
  onImport: (code: string, name: string, bp: Blueprint) => Promise<void>
  onBack: () => void
  onParseInstead: () => void
}) {
  const [list, setList] = useState<Blueprint[] | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void (async () => {
      const { data } = await supabase.from('shared_blueprints').select(BP_COLS).eq('course_code', code)
      if (!active) return
      const all = (data as BlueprintRow[] | null)?.map(blueprintFromRow) ?? []
      setList(all.filter((b) => notPastTerm(b.term)))
    })()
    return () => {
      active = false
    }
  }, [code])

  const importBp = async (bp: Blueprint) => {
    setBusyId(bp.id)
    await onImport(code, name, bp)
    // On success the parent switches mode and this unmounts (no-op); on a rare
    // failure, clear busy so the picker isn't stuck.
    setBusyId(null)
  }

  const sections =
    list &&
    [
      ...list
        .reduce((m, b) => {
          const s = b.section || '—'
          return m.set(s, [...(m.get(s) ?? []), b])
        }, new Map<string, Blueprint[]>())
        .entries(),
    ].sort((a, b) => a[0].localeCompare(b[0]))

  return (
    <div className="mx-auto w-full max-w-lg">
      <BackBtn onClick={onBack} label="Other courses" />
      <h2 className="mt-2 text-center font-display text-[21px] font-semibold text-fg sm:text-[28px]">Choose your section</h2>
      <p className="mt-2 text-center text-[13px] text-muted sm:text-[14px]">
        <span className="font-semibold text-fg">{code}</span>
        {name && name !== code ? ` · ${name}` : ''} — dates can differ by section, so pick yours.
      </p>

      <div className="mt-4 space-y-5">
        {list === null ? (
          <div className="grid place-items-center py-8">
            <Loader2 className="size-5 animate-spin text-accent" aria-label="Loading" />
          </div>
        ) : sections && sections.length > 0 ? (
          sections.map(([section, bps]) => {
            const teacher = bps.find((b) => b.teacherVerified)
            const shown = teacher ? [teacher] : [...bps].sort((a, b) => netVotes(b) - netVotes(a))
            return (
              <div key={section}>
                <p className="mb-1.5 text-[11px] font-bold tracking-[0.14em] text-subtle uppercase">
                  Section {section}
                </p>
                <div className="space-y-2">
                  {shown.map((bp, i) => (
                    <BlueprintPick
                      key={bp.id}
                      bp={bp}
                      teacher={!!teacher}
                      top={!teacher && i === 0 && shown.length > 1}
                      busy={busyId === bp.id}
                      disabled={busyId !== null}
                      onImport={() => void importBp(bp)}
                    />
                  ))}
                </div>
              </div>
            )
          })
        ) : (
          <p className="rounded-xl border border-border bg-surface px-4 py-6 text-center text-[13px] text-subtle">
            No outline for this course this term.
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={onParseInstead}
        className="mt-5 inline-flex w-full items-center justify-center gap-1.5 text-[13px] font-medium text-muted transition-colors duration-150 hover:text-fg"
      >
        I don't see my section — upload a syllabus instead
        <ArrowRight size={14} aria-hidden />
      </button>
    </div>
  )
}

function BlueprintPick({
  bp,
  teacher,
  top,
  busy,
  disabled,
  onImport,
}: {
  bp: Blueprint
  teacher: boolean
  top: boolean
  busy: boolean
  disabled: boolean
  onImport: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onImport}
      className="flex w-full items-center gap-3 rounded-xl border border-border bg-surface p-3 text-left transition-colors duration-150 hover:border-accent disabled:opacity-60"
    >
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          {teacher ? (
            <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-accent">
              <ShieldCheck size={14} aria-hidden /> Teacher-verified
            </span>
          ) : (
            <span className="text-[13px] font-semibold text-fg">{bp.author}</span>
          )}
          {top && (
            <span className="rounded bg-accent-soft px-1.5 py-0.5 text-[9.5px] font-bold tracking-wide text-accent uppercase">
              Top pick
            </span>
          )}
        </span>
        <span className="mt-0.5 block text-[12px] text-subtle">
          {bp.dates.length} item{bp.dates.length === 1 ? '' : 's'}
          {!teacher && ` · ▲ ${netVotes(bp)}`}
          {bp.instructor ? ` · ${bp.instructor}` : ''}
        </span>
      </span>
      {busy ? (
        <Loader2 className="size-4 shrink-0 animate-spin text-accent" aria-label="Importing" />
      ) : (
        <span className="shrink-0 text-[12px] font-medium text-accent">Import</span>
      )}
    </button>
  )
}

function PdfParse({ onParsed }: { onParsed: () => void }) {
  const reduced = usePrefersReducedMotion()
  const [phase, setPhase] = useState<Phase>('armed')
  const [revealed, setRevealed] = useState(0)
  const started = useRef(false)
  const total = COMM221_PARSED.length

  useEffect(() => {
    if (started.current) return
    started.current = true
    const timers: ReturnType<typeof setTimeout>[] = []
    const at = (fn: () => void, ms: number) => timers.push(setTimeout(fn, ms))
    if (reduced) {
      at(() => {
        setPhase('done')
        setRevealed(total)
      }, 200)
      at(onParsed, 400)
    } else {
      at(() => setPhase('drop'), 0)
      at(() => setPhase('scanning'), 600)
      at(() => setPhase('revealing'), 1700)
      for (let i = 1; i <= total; i++) at(() => setRevealed(i), 1700 + i * 240)
      at(() => setPhase('done'), 1700 + total * 240 + 300)
      at(onParsed, 1700 + total * 240 + 950)
    }
    return () => timers.forEach(clearTimeout)
  }, [reduced, total, onParsed])

  return <CompactParse phase={phase} revealed={revealed} />
}

/** Compact, single-column parse — fits a phone, plays on all sizes. */
function CompactParse({ phase, revealed }: { phase: Phase; revealed: number }) {
  const scanning = phase === 'drop' || phase === 'scanning'
  const parsed = phase === 'revealing' || phase === 'done'
  const total = COMM221_PARSED.length
  return (
    <div className="mx-auto mt-5 max-w-md rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[12px] font-medium text-muted">
          <span className="rounded bg-danger/15 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-danger uppercase">PDF</span>
          syllabus.pdf
        </span>
        <span className="text-[11px] text-subtle">
          {parsed ? (phase === 'done' ? `${total} dates found` : `${revealed} of ${total}`) : 'Scanning…'}
        </span>
      </div>

      {!parsed ? (
        <div className="relative mt-3 overflow-hidden rounded-lg border border-border bg-canvas/50 p-3 font-mono text-[10px] leading-relaxed text-subtle">
          <p className="text-[10.5px] font-semibold text-fg">COMM 221 · Financial Markets</p>
          <p className="mt-1.5 text-muted">Grade Composition:</p>
          <div className="mt-1 space-y-1">
            {RAW_ROWS.slice(0, 4).map(([label, w, when]) => (
              <div key={label} className="flex items-baseline justify-between gap-2">
                <span className="truncate">{label}</span>
                <span className="shrink-0 tabular-nums text-muted">
                  {w} · {when}
                </span>
              </div>
            ))}
          </div>
          {scanning && (
            <div className="ct-scan-sweep pointer-events-none absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-accent/0 via-accent/25 to-accent/0" aria-hidden />
          )}
        </div>
      ) : (
        <ul className="mt-3 divide-y divide-border">
          {COMM221_PARSED.slice(0, revealed).map((a) => (
            <li key={a.id} className="ct-reveal-item flex items-center justify-between gap-2 py-2">
              <span className="truncate text-[12px] font-medium text-fg">{a.title}</span>
              <span className="shrink-0 text-[11px] font-semibold text-fg">{a.due}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ChoiceTile({ icon: Icon, label, desc, onClick }: { icon: typeof FileText; label: string; desc: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-row items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3.5 text-left transition-colors duration-150 hover:border-accent sm:flex-col sm:gap-2.5 sm:px-5 sm:py-6 sm:text-center"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent sm:size-11">
        <Icon size={20} aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block text-[14px] font-semibold text-fg sm:text-[15px]">{label}</span>
        <span className="mt-0.5 line-clamp-2 block text-[12px] leading-relaxed text-subtle sm:mt-0 sm:line-clamp-none">{desc}</span>
      </span>
    </button>
  )
}

function BackBtn({ onClick, label = 'Other options' }: { onClick: () => void; label?: string }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex items-center gap-1 text-[12px] font-medium text-subtle transition-colors duration-150 hover:text-fg">
      <ArrowLeft size={14} aria-hidden /> {label}
    </button>
  )
}
