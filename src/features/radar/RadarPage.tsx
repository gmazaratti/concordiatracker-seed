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
import { TermStrip } from './TermStrip'
import { radarSummary, runRadar, weeklyLoad, type Severity, type Signal } from './rules'

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

  const signals = useMemo(
    () =>
      runRadar({
        now,
        courses,
        pastCourses,
        assessments,
        calendar: ACADEMIC_CALENDAR,
        recordComplete,
      }),
    [now, courses, pastCourses, assessments, recordComplete],
  )

  const summary = radarSummary(signals)
  const weeks = useMemo(() => weeklyLoad(assessments, now, 15), [assessments, now])
  const hasLoad = weeks.some((w) => w.weight > 0)
  const Icon = TONE[summary.severity].icon

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-5 sm:px-6">
      <header className="mb-5">
        <div className="flex items-center gap-2">
          <h1 className="font-display text-[26px] leading-tight font-medium text-fg">Radar</h1>
          <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-subtle uppercase">
            Trial
          </span>
        </div>
        <p className="mt-0.5 text-[13px] text-subtle">The things that go wrong quietly.</p>
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
          <p className="mt-0.5 text-[12px] text-subtle">
            Checked against your courses, your grades, your outlines and the registrar&rsquo;s
            calendar. Nothing here leaves your account.
          </p>
        </div>
      </section>

      {/* ── The shape of the term ────────────────────────────────────── */}
      {hasLoad && (
        <section className="mt-4 rounded-xl border border-border bg-surface p-4">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-[13px] font-semibold text-fg">The shape of your term</h2>
            <p className="text-[11.5px] text-subtle">
              Every course, on one axis — which is the only place a collision shows up.
            </p>
          </div>
          <TermStrip weeks={weeks} />
        </section>
      )}

      {/* ── Signals ──────────────────────────────────────────────────── */}
      <div className="mt-4 space-y-3">
        {signals.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-6 py-12 text-center">
            <ShieldCheck size={22} className="mx-auto text-success" aria-hidden />
            <p className="mt-3 text-[14px] font-medium text-fg">Nothing on the radar</p>
            <p className="mx-auto mt-1 max-w-md text-[12.5px] leading-relaxed text-subtle">
              No collisions, no deadlines closing, no course whose arithmetic has turned. This page
              is quiet on purpose — it is meant to be empty most of the time and loud when it is not.
            </p>
          </div>
        ) : (
          signals.map((signal) => <SignalCard key={signal.id} signal={signal} />)
        )}
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
