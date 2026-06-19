import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, FileText, Loader2, Search, ShieldCheck } from 'lucide-react'
import { useAppData } from '@/app/providers/app-data'
import { usePrefersReducedMotion } from '@/app/hooks/usePrefersReducedMotion'
import { COMM221_PARSED, RAW_ROWS, type Phase } from '@/features/landing/parse-demo-data'
import { useAllBlueprintCourses } from '@/features/courses/useBlueprints'
import { blueprintToAssessments, netVotes } from '@/data/blueprints'
import { blueprintFromRow, type BlueprintRow } from '@/lib/supabase-adapters'
import { supabase } from '@/lib/supabase'
import type { Assessment } from '@/data/types'
import { ONBOARD_COURSES, toAssessments } from './onboarding-data'

type Mode = 'choose' | 'search' | 'pdf' | 'done'
const DAY = 86_400_000

/** Interactive first-course add — search for a course to import its outline, OR
 * upload a syllabus to parse. Both create a real course + assessments. */
export function AddFirstCourse({ onAdded }: { onAdded: () => void }) {
  const { createCourse, addAssessments } = useAppData()
  const [mode, setMode] = useState<Mode>('choose')
  const [added, setAdded] = useState<{ code: string; count: number } | null>(null)
  const [busy, setBusy] = useState(false)

  const commit = async (code: string, title: string, items: Assessment[]) => {
    const id = await createCourse({ code, title })
    if (!id) return
    await addAssessments(items.map((a) => ({ ...a, id: crypto.randomUUID(), courseId: id })))
    setAdded({ code, count: items.length })
    setMode('done')
    onAdded()
  }

  // Import a real shared outline for a code, re-based so its dates are upcoming.
  const importCode = async (code: string, name: string) => {
    setBusy(true)
    const { data } = await supabase.from('shared_blueprints').select('*').eq('course_code', code)
    const list = (data as BlueprintRow[] | null)?.map(blueprintFromRow) ?? []
    if (list.length === 0) {
      setBusy(false)
      setMode('pdf') // no outline for this code → fall through to the parser
      return
    }
    const best = [...list].sort(
      (a, b) => Number(b.teacherVerified) - Number(a.teacherVerified) || netVotes(b) - netVotes(a),
    )[0]
    const items = blueprintToAssessments(best)
    const minDue = Math.min(...items.map((a) => +new Date(a.due)))
    const offset = Date.now() + 5 * DAY - minDue // shift so the earliest lands ~5 days out
    const rebased = items.map((a) => ({ ...a, due: new Date(+new Date(a.due) + offset).toISOString() }))
    await commit(code, name, rebased)
    setBusy(false)
  }

  if (mode === 'done' && added) {
    return (
      <Centered heading={`${added.code} is in`} sub={`${added.count} deadlines just landed on your calendar — you'll see them on Today.`}>
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-success/15 text-success">
          <Check size={30} aria-hidden />
        </span>
      </Centered>
    )
  }

  if (mode === 'pdf') {
    return (
      <div className="mx-auto w-full max-w-md">
        <BackBtn onClick={() => setMode('choose')} />
        <h2 className="mt-2 text-center font-display text-[20px] font-semibold text-fg sm:text-[26px]">Reading your syllabus…</h2>
        <PdfParse onParsed={() => void commit(ONBOARD_COURSES[0].code, ONBOARD_COURSES[0].title, toAssessments(ONBOARD_COURSES[0], ''))} />
      </div>
    )
  }

  if (mode === 'search') {
    return <SearchCourses busy={busy} onPick={importCode} onParseInstead={() => setMode('pdf')} onBack={() => setMode('choose')} />
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col text-center">
      <h2 className="font-display text-[21px] leading-tight font-semibold text-fg sm:text-[28px]">Add your first course</h2>
      <p className="mt-2 text-[13px] leading-relaxed text-muted sm:text-[14px]">Two ways in — pick whichever fits your class.</p>
      <div className="mt-5 grid gap-3 sm:mt-6 sm:grid-cols-2">
        <ChoiceTile
          icon={Search}
          label="Find your course"
          desc="Search for your class and import a ready-made outline. Every deadline and weight fills in instantly — best if your course already has a shared or teacher-verified outline."
          onClick={() => setMode('search')}
        />
        <ChoiceTile
          icon={FileText}
          label="Upload a syllabus"
          desc="Got the syllabus PDF? We scan it and lift out every deadline, weight, and grade automatically — no typing. Best if your course is new or not listed yet."
          onClick={() => setMode('pdf')}
        />
      </div>
    </div>
  )
}

function SearchCourses({
  busy,
  onPick,
  onParseInstead,
  onBack,
}: {
  busy: boolean
  onPick: (code: string, name: string) => void
  onParseInstead: () => void
  onBack: () => void
}) {
  const { list, loading } = useAllBlueprintCourses()
  const [q, setQ] = useState('')
  const needle = q.trim().toLowerCase()
  const results = needle
    ? list.filter((c) => c.code.toLowerCase().includes(needle) || c.courseName.toLowerCase().includes(needle))
    : list.slice(0, 6)

  return (
    <div className="mx-auto w-full max-w-lg">
      <BackBtn onClick={onBack} />
      <h2 className="mt-2 text-center font-display text-[21px] font-semibold text-fg sm:text-[28px]">Find your course</h2>
      <p className="mt-2 text-center text-[13px] text-muted sm:text-[14px]">Search by code or name, then import its outline.</p>

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
          <p className="rounded-xl border border-border bg-surface px-4 py-6 text-center text-[13px] text-subtle">No outline for that course yet.</p>
        ) : (
          results.map((c) => (
            <button
              key={c.code}
              type="button"
              disabled={busy}
              onClick={() => onPick(c.code, c.courseName || c.code)}
              className="flex w-full items-center gap-3 rounded-xl border border-border bg-surface p-2.5 text-left transition-colors duration-150 hover:border-accent disabled:opacity-60 sm:p-3.5"
            >
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="text-[14px] font-semibold text-fg">{c.code}</span>
                  {c.hasVerified && <ShieldCheck size={14} className="text-accent" aria-label="Teacher-verified" />}
                </span>
                <span className="block truncate text-[12px] text-subtle">{c.courseName || `${c.count} outline${c.count === 1 ? '' : 's'}`}</span>
              </span>
              <span className="shrink-0 text-[12px] font-medium text-accent">Import</span>
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

function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex items-center gap-1 text-[12px] font-medium text-subtle transition-colors duration-150 hover:text-fg">
      <ArrowLeft size={14} aria-hidden /> Other options
    </button>
  )
}

function Centered({ heading, sub, children }: { heading: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col text-center">
      <h2 className="font-display text-[24px] leading-tight font-semibold text-fg sm:text-[28px]">{heading}</h2>
      <p className="mt-2 text-[14px] leading-relaxed text-muted">{sub}</p>
      <div className="mt-6">{children}</div>
    </div>
  )
}
