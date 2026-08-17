import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Eye,
  Info,
  ShieldCheck,
} from 'lucide-react'
import { useAppData } from '@/app/providers/app-data'
import { ACADEMIC_CALENDAR } from '@/data/academic-calendar'
import { loadAcademicProfile } from '@/lib/academic-record'
import { formatMonthDay } from '@/lib/date'
import { parseDay } from '@/features/calendar/calendar'
import { usePageMeta } from '@/app/hooks/usePageMeta'
import { cn } from '@/lib/cn'
import { DropSimulator } from './DropSimulator'
import { TermStrip } from './TermStrip'
import { WhatItWatches } from './WhatItWatches'
import {
  checkStates,
  radarSummary,
  runRadar,
  weeklyLoad,
  type Severity,
  type Signal,
} from './rules'

/**
 * Radar — the things that go wrong quietly.
 *
 * Today tells you what is due. Calendar tells you when. Neither tells you that
 * the term is about to bite: that three midterms share a fortnight, that
 * dropping tomorrow costs a transcript line, that the course you are carrying
 * can no longer reach a C. Those are all knowable from data this app already
 * holds, and none of them is visible from a list of deadlines.
 *
 * The page is a feed of signals, worst first, each one carrying the basis for
 * its claim. Every rule lives in `rules.ts`, is pure, and is tested in Node —
 * because the failure mode here is not a broken layout, it is telling somebody
 * something untrue about their degree.
 */
const TONE: Record<Severity, { rail: string; text: string; icon: typeof AlertTriangle }> = {
  critical: { rail: 'bg-danger', text: 'text-danger', icon: AlertTriangle },
  warning: { rail: 'bg-warning', text: 'text-warning', icon: AlertTriangle },
  watch: { rail: 'bg-info', text: 'text-info', icon: Eye },
  clear: { rail: 'bg-success', text: 'text-success', icon: CheckCircle2 },
}

const TOPIC_LABEL: Record<Signal['topic'], string> = {
  load: 'Workload',
  deadlines: 'Deadlines',
  grades: 'Grades',
  coverage: 'What we can see',
}

export function RadarPage() {
  usePageMeta({
    title: 'Radar',
    description: 'The things that go wrong quietly.',
    path: '/app/radar',
    robots: 'noindex',
  })
  const { courses, pastCourses, assessments } = useAppData()
  const [recordComplete, setRecordComplete] = useState(false)
  /** Courses switched off in the simulator. Never written anywhere. */
  const [excluded, setExcluded] = useState<Set<string>>(new Set())

  useEffect(() => {
    let alive = true
    void loadAcademicProfile()
      .then((p) => alive && setRecordComplete(p.recordComplete))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  // One `now` per render pass, so every rule agrees about what day it is.
  const now = useMemo(() => new Date(), [])

  // The simulator works by feeding the rules a smaller term. Nothing branches
  // on "are we simulating" — the same rules run on a different input, which is
  // why dropping a course correctly surfaces the cost of dropping it.
  const liveCourses = useMemo(
    () => courses.filter((c) => !excluded.has(c.id)),
    [courses, excluded],
  )
  const liveAssessments = useMemo(
    () => assessments.filter((a) => !excluded.has(a.courseId)),
    [assessments, excluded],
  )

  const signals = useMemo(
    () =>
      runRadar({
        now,
        courses: liveCourses,
        pastCourses,
        assessments: liveAssessments,
        calendar: ACADEMIC_CALENDAR,
        recordComplete,
      }),
    [now, liveCourses, pastCourses, liveAssessments, recordComplete],
  )

  const states = useMemo(
    () =>
      checkStates({
        now,
        courses: liveCourses,
        pastCourses,
        assessments: liveAssessments,
        calendar: ACADEMIC_CALENDAR,
        recordComplete,
      }),
    [now, liveCourses, pastCourses, liveAssessments, recordComplete],
  )

  const summary = radarSummary(signals)
  const weeks = useMemo(() => weeklyLoad(liveAssessments, now, 15), [liveAssessments, now])
  const hasLoad = weeks.some((w) => w.weight > 0)
  const Icon = TONE[summary.severity].icon

  return (
    <div className="mx-auto w-full max-w-3xl">
      <header className="mb-5">
        <div className="flex items-center gap-2">
          <h2 className="font-display text-[20px] leading-tight font-medium text-fg">Radar</h2>
          <span className="rounded bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-accent uppercase">
            Beta
          </span>
        </div>
        {/* The old subtitle was a slogan. A page nobody can describe after
            reading its title has failed at the title. */}
        <p className="mt-1 max-w-2xl text-[13.5px] leading-relaxed text-muted">
          An automatic check on your semester. It reads your courses, grades, outlines and the
          registrar&rsquo;s calendar, and tells you about problems that are coming but not yet
          obvious — a week where too much of your grade lands at once, a drop deadline about to
          close, a course the marks can no longer save.
        </p>
        <p className="mt-1.5 text-[12.5px] text-subtle">
          Today shows what is due. Calendar shows when. Radar is the one that says whether the term
          ahead is survivable — which needs every course added together, so nothing else can.
        </p>
      </header>

      {/* ── Status ───────────────────────────────────────────────────── */}
      <section
        className={cn(
          'flex items-start gap-3 rounded-xl border p-4',
          summary.severity === 'critical'
            ? 'border-danger/40 bg-danger/5'
            : summary.severity === 'warning'
              ? 'border-warning/40 bg-warning/5'
              : 'border-border bg-surface',
        )}
      >
        <Icon size={18} className={cn('mt-0.5 shrink-0', TONE[summary.severity].text)} aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-medium text-fg">{summary.headline}</p>
          {excluded.size > 0 && (
            <p className="mt-1 inline-block rounded bg-surface-2 px-1.5 py-0.5 text-[11px] font-medium text-muted">
              Simulated — without{' '}
              {courses
                .filter((c) => excluded.has(c.id))
                .map((c) => c.code)
                .join(', ')}
            </p>
          )}
          <p className="mt-0.5 text-[12px] text-subtle">
            {states.length} checks ran just now, on your account alone. Nothing here is sent
            anywhere, and none of it changes your registration.
          </p>
        </div>
      </section>

      {/* ── The shape of the term ────────────────────────────────────── */}
      {hasLoad && (
        <section className="mt-4 rounded-xl border border-border bg-surface p-4">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-[13px] font-semibold text-fg">How heavy each week is</h2>
            <p className="text-[11.5px] text-subtle">
              Each bar is one week of the term
            </p>
          </div>
          <TermStrip weeks={weeks} />

          <div className="mt-4 border-t border-border pt-3.5">
            <DropSimulator
              courses={courses}
              excluded={excluded}
              onToggle={(id) =>
                setExcluded((prev) => {
                  const next = new Set(prev)
                  if (next.has(id)) next.delete(id)
                  else next.add(id)
                  return next
                })
              }
              onReset={() => setExcluded(new Set())}
            />
          </div>
        </section>
      )}

      {/* ── Signals ──────────────────────────────────────────────────── */}
      {signals.length > 0 && (
        <>
          <h2 className="mt-6 mb-2 text-[13px] font-semibold text-fg">
            What it found{' '}
            <span className="font-normal text-subtle">
              · {signals.length} {signals.length === 1 ? 'thing' : 'things'}, most pressing first
            </span>
          </h2>
          <div className="space-y-3">
            {signals.map((signal) => (
              <SignalCard key={signal.id} signal={signal} />
            ))}
          </div>
        </>
      )}

      {signals.length === 0 && (
        <div className="mt-4 rounded-xl border border-dashed border-border px-6 py-10 text-center">
          <ShieldCheck size={22} className="mx-auto text-success" aria-hidden />
          <p className="mt-3 text-[14px] font-medium text-fg">Nothing to flag</p>
          <p className="mx-auto mt-1 max-w-md text-[12.5px] leading-relaxed text-subtle">
            Every check below came back clear. This page is meant to be empty most of the time and
            loud when it is not.
          </p>
        </div>
      )}

      {/* Always shown, found something or not: see the sweep, not just the hits. */}
      <div className="mt-6">
        <WhatItWatches states={states} />
      </div>

      <p className="mt-5 text-[11.5px] leading-relaxed text-subtle">
        Radar reads what you have already told ConcordiaTracker. It cannot see a course you have not
        added or an outline you have not imported, and it is not advice — for anything that changes
        your registration, your loan or your graduation, the department is the authority.
      </p>
    </div>
  )
}

function SignalCard({ signal }: { signal: Signal }) {
  const [why, setWhy] = useState(false)
  const tone = TONE[signal.severity]
  return (
    <article className="flex overflow-hidden rounded-xl border border-border bg-surface">
      {/* A rail rather than a coloured card: severity should be legible at a
          glance without the whole page turning red. */}
      <span className={cn('w-1 shrink-0', tone.rail)} aria-hidden />
      <div className="min-w-0 flex-1 p-3.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className={cn('text-[10.5px] font-semibold tracking-wide uppercase', tone.text)}>
            {signal.severity === 'watch' ? 'Keep an eye' : signal.severity}
          </span>
          <span className="text-[10.5px] text-subtle">· {TOPIC_LABEL[signal.topic]}</span>
          {signal.by && (
            <span className="ml-auto inline-flex items-center gap-1 rounded bg-surface-2 px-1.5 py-0.5 text-[10.5px] text-subtle">
              <CalendarClock size={10} aria-hidden />
              {formatMonthDay(parseDay(signal.by))}
            </span>
          )}
        </div>

        <h3 className="mt-1 text-[14px] font-medium text-fg">{signal.title}</h3>
        <p className="mt-1 text-[12.5px] leading-relaxed text-muted">{signal.detail}</p>

        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          {signal.action && (
            <Link
              to={signal.action.to}
              className="inline-flex items-center gap-1 text-[12px] font-medium text-accent transition-colors duration-150 hover:underline"
            >
              {signal.action.label}
              <ArrowRight size={12} aria-hidden />
            </Link>
          )}
          {/* Every claim can be interrogated. A warning you cannot check is a
              warning you learn to ignore. */}
          <button
            type="button"
            onClick={() => setWhy((w) => !w)}
            aria-expanded={why}
            className="inline-flex items-center gap-1 text-[11.5px] text-subtle transition-colors duration-150 hover:text-fg"
          >
            <Info size={11} aria-hidden />
            {why ? 'Hide' : 'Why am I seeing this?'}
          </button>
        </div>

        {why && (
          <p className="mt-2 rounded-lg border border-border bg-canvas px-2.5 py-2 text-[11.5px] leading-relaxed text-subtle">
            {signal.basis}
          </p>
        )}
      </div>
    </article>
  )
}
