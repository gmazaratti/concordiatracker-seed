import { useEffect, useMemo, useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { useAppData } from '@/app/providers/app-data'
import { usePageMeta } from '@/app/hooks/usePageMeta'
import { ACADEMIC_CALENDAR } from '@/data/academic-calendar'
import { loadAcademicProfile } from '@/lib/academic-record'
import { DropSimulator } from './DropSimulator'
import { RadarHero } from './RadarHero'
import { LeadSignal, SignalCard, SignalRow } from './SignalCard'
import { TopicTiles } from './TopicTiles'
import { TermStrip } from './TermStrip'
import { WhatItWatches } from './WhatItWatches'
import { checkStates, radarSummary, runRadar, weeklyLoad, type Signal } from './rules'

/**
 * Radar: the things that go wrong quietly.
 *
 * Today tells you what is due. Calendar tells you when. Neither tells you that
 * the term is about to bite: that three midterms share a fortnight, that
 * dropping tomorrow costs a transcript line, that the course you are carrying
 * can no longer reach a C. Those are all knowable from data this app already
 * holds, and none of them is visible from a list of deadlines.
 *
 * The page reads top to bottom as verdict (the banner), what it found (worst
 * first, the first one large), the shape of the term with the drop simulator,
 * and every check it ran. Every rule lives in `rules.ts`, is pure, and is
 * tested in Node, because the failure mode here is not a broken layout, it is
 * telling somebody something untrue about their degree.
 */
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
  /** The topic tile that is narrowing the findings, if any. */
  const [topic, setTopic] = useState<Signal['topic'] | null>(null)

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
  // on "are we simulating": the same rules run on a different input, which is
  // why dropping a course correctly surfaces the cost of dropping it.
  const liveCourses = useMemo(() => courses.filter((c) => !excluded.has(c.id)), [courses, excluded])
  const liveAssessments = useMemo(() => assessments.filter((a) => !excluded.has(a.courseId)), [assessments, excluded])

  const input = useMemo(
    () => ({
      now,
      courses: liveCourses,
      pastCourses,
      assessments: liveAssessments,
      calendar: ACADEMIC_CALENDAR,
      recordComplete,
    }),
    [now, liveCourses, pastCourses, liveAssessments, recordComplete],
  )
  const signals = useMemo(() => runRadar(input), [input])
  const states = useMemo(() => checkStates(input), [input])

  const summary = radarSummary(signals)
  const weeks = useMemo(() => weeklyLoad(liveAssessments, now, 15), [liveAssessments, now])
  const hasLoad = weeks.some((w) => w.weight > 0)
  const topicCounts = useMemo(() => {
    const c: Record<Signal['topic'], number> = { load: 0, deadlines: 0, grades: 0, coverage: 0 }
    for (const s of signals) c[s.topic]++
    return c
  }, [signals])
  // The page is three tiers, not one list: the single most pressing thing, the
  // other things to handle this week, and what only needs watching.
  const shown = topic ? signals.filter((s) => s.topic === topic) : signals
  const [lead, ...others] = shown
  const urgent = others.filter((s) => s.severity === 'critical' || s.severity === 'warning')
  const watching = others.filter((s) => s.severity !== 'critical' && s.severity !== 'warning')

  return (
    <div className="w-full space-y-10 pb-4">
      <RadarHero
        severity={summary.severity}
        headline={summary.headline}
        simulated={courses.filter((c) => excluded.has(c.id)).map((c) => c.code || 'Untitled')}
        counts={{
          checks: states.length,
          found: states.filter((s) => s.state === 'alert').length,
          clear: states.filter((s) => s.state === 'clear').length,
          idle: states.filter((s) => s.state === 'idle').length,
        }}
      />

      {/* ── What it found ────────────────────────────────────────────── */}
      <section aria-labelledby="radar-found">
        <h3 id="radar-found" className="font-display text-[22px] font-semibold tracking-tight text-fg">
          What it found
        </h3>
        {signals.length > 0 && (
          <>
            <p className="mt-0.5 text-[13px] text-muted">
              {signals.length} {signals.length === 1 ? 'thing' : 'things'} across four areas. Tap an area to see only
              that.
            </p>
            <div className="mt-4">
              <TopicTiles counts={topicCounts} active={topic} onPick={setTopic} />
            </div>
          </>
        )}
        {lead ? (
          // Keyed on the filter and the simulated set, so a change replays the entrance.
          <div key={`${topic ?? 'all'}:${[...excluded].join()}`} className="mt-4 space-y-3">
            <LeadSignal signal={lead} now={now} />
            {urgent.length > 0 && (
              <div className="grid gap-3 xl:grid-cols-2">
                {urgent.map((s, i) => (
                  <SignalCard key={s.id} signal={s} now={now} delay={(i + 1) * 55} />
                ))}
              </div>
            )}
            {watching.length > 0 && (
              <div className="ct-res-in overflow-hidden rounded-3xl border border-border bg-surface" style={{ animationDelay: '160ms' }}>
                <p className="border-b border-border/60 px-4 py-3 text-[12px] font-semibold tracking-[0.12em] text-subtle uppercase sm:px-5">
                  Keep an eye on · {watching.length}
                </p>
                <ul className="divide-y divide-border/60">
                  {watching.map((s) => (
                    <SignalRow key={s.id} signal={s} now={now} />
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : signals.length > 0 ? (
          <p className="mt-4 rounded-3xl border border-dashed border-border-strong px-6 py-8 text-center text-[14px] text-muted">
            Nothing found in this area.{' '}
            <button type="button" onClick={() => setTopic(null)} className="font-semibold text-accent hover:underline">
              Show everything
            </button>
          </p>
        ) : (
          <div className="mt-4 flex flex-col items-center rounded-3xl border border-dashed border-border-strong px-6 py-12 text-center">
            <span className="grid size-12 place-items-center rounded-full bg-success text-white">
              <ShieldCheck size={22} aria-hidden />
            </span>
            <p className="mt-3 font-display text-[20px] font-semibold text-fg">Nothing to flag</p>
            <p className="mt-1 max-w-md text-[13.5px] leading-relaxed text-muted">
              Every check that could run came back clear. This page is meant to be quiet most of the time and loud when
              it is not.
            </p>
          </div>
        )}
      </section>

      {/* ── The shape of the term ────────────────────────────────────── */}
      {hasLoad && (
        <section aria-labelledby="radar-shape">
          <h3 id="radar-shape" className="font-display text-[22px] font-semibold tracking-tight text-fg">
            The shape of your term
          </h3>
          <p className="mt-0.5 text-[13px] text-muted">
            One bar per week, as tall as the share of your final grades landing in it. Tap a bar to see what is in it.
          </p>
          <div className="ct-res-in mt-4 rounded-3xl border border-border bg-surface p-5 sm:p-6">
            <TermStrip weeks={weeks} />
            <div className="mt-5 border-t border-border pt-5">
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
          </div>
        </section>
      )}

      {/* Always shown, found something or not: see the sweep, not just the hits. */}
      <WhatItWatches states={states} />

      <p className="border-t border-border pt-4 text-[12px] leading-relaxed text-subtle">
        Radar reads what you have already told ConcordiaTracker. It cannot see a course you have not added or an outline
        you have not imported, and it is not advice. For anything that changes your registration, your loan or your
        graduation, the department is the authority. Photo:{' '}
        <a
          href="https://commons.wikimedia.org/wiki/File:EV_Building_2009_01,_QC.jpg"
          target="_blank"
          rel="noreferrer noopener"
          className="underline underline-offset-2 hover:text-fg"
        >
          JasonParis
        </a>
        , CC BY 2.0, cropped and darkened.
      </p>
    </div>
  )
}
