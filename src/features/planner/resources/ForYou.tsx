import { Link } from 'react-router-dom'
import { ArrowRight, CalendarClock } from 'lucide-react'
import { GUIDE, STAGES, findResource, seasonStep, type GuideStep, type Stage } from '@/data/resource-guide'
import type { Guide } from '@/data/guides'
import type { Resource } from '@/data/resources'
import { Segmented } from '@/features/settings/controls'
import { GuideCard } from './GuideShelf'

/**
 * The short list for where you are in the degree. The stage is a guess from
 * finished credits and says so; the switch is right there because a first
 * year who has not entered past courses looks the same as a new student.
 */
export function ForYou({
  stage,
  setStage,
  guessed,
  faculty,
  month,
  onOpen,
  guide,
  onRead,
}: {
  stage: Stage
  setStage: (s: Stage) => void
  guessed: boolean
  faculty: Resource['faculty'] | null
  month: number
  onOpen: (r: Resource) => void
  /** The guide written for this stage: the picture half of the section. */
  guide: Guide
  onRead: (slug: string) => void
}) {
  const info = STAGES.find((s) => s.id === stage)!
  const steps = GUIDE[stage]
  const season = seasonStep(month)
  return (
    <section aria-labelledby="res-foryou">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h3 id="res-foryou" className="font-display text-[22px] font-semibold tracking-tight text-fg">
            Worth knowing in your {info.label.toLowerCase()}
          </h3>
          <p className="mt-0.5 text-[13px] text-muted">
            {info.blurb}
            {guessed && <span className="text-subtle"> Guessed from your finished credits; change it if it is off.</span>}
          </p>
        </div>
        <Segmented
          ariaLabel="Where you are in your degree"
          value={stage}
          onChange={setStage}
          options={STAGES.map((s) => ({ value: s.id, label: s.label }))}
        />
      </div>

      {/* Keyed on the stage so switching replays the entrance. */}
      <div key={stage} className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <GuideCard g={guide} onRead={onRead} fill />
        <ul className="grid gap-2">
          {steps.map((st, i) => (
            <StepCard key={st.title} step={st} faculty={faculty} onOpen={onOpen} delay={(i + 1) * 55} />
          ))}
        </ul>
      </div>

      <div
        className="ct-res-in mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-warning/30 bg-warning/[0.07] px-4 py-3"
        style={{ animationDelay: '260ms' }}
      >
        <CalendarClock size={18} className="shrink-0 text-warning" aria-hidden />
        <div className="min-w-0 flex-1 basis-60">
          <p className="text-[13.5px] font-semibold text-fg">This time of year: {season.title.toLowerCase()}</p>
          <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted">{season.why}</p>
        </div>
        <Go step={season} faculty={faculty} onOpen={onOpen} quiet />
      </div>
    </section>
  )
}

function StepCard({
  step,
  faculty,
  onOpen,
  delay,
}: {
  step: GuideStep
  faculty: Resource['faculty'] | null
  onOpen: (r: Resource) => void
  delay: number
}) {
  return (
    <li
      className="ct-res-in rounded-2xl border border-border bg-surface px-4 py-3.5 transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-border-strong"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="min-w-0 flex-1">
        <p className="text-[14.5px] font-semibold text-fg">{step.title}</p>
        <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted">{step.why}</p>
        <div className="mt-1.5">
          <Go step={step} faculty={faculty} onOpen={onOpen} quiet />
        </div>
      </div>
    </li>
  )
}

/** The step's action: an office sheet, an official page, or a place in the app. */
function Go({
  step,
  faculty,
  onOpen,
  quiet,
}: {
  step: GuideStep
  faculty: Resource['faculty'] | null
  onOpen: (r: Resource) => void
  quiet?: boolean
}) {
  const cls = quiet
    ? 'inline-flex items-center gap-1 text-[12.5px] font-semibold text-accent hover:underline'
    : 'inline-flex items-center gap-1.5 rounded-xl bg-accent px-3.5 py-2 text-[13.5px] font-semibold text-accent-contrast transition-colors duration-150 hover:bg-accent-hover'
  const inner = (
    <>
      {step.cta} <ArrowRight size={quiet ? 13 : 15} aria-hidden />
    </>
  )
  if (step.to) return <Link to={step.to} className={cls}>{inner}</Link>
  const r = findResource(step.resource, faculty)
  if (r) return <button type="button" onClick={() => onOpen(r)} className={cls}>{inner}</button>
  if (step.url) return <a href={step.url} target="_blank" rel="noreferrer noopener" className={cls}>{inner}</a>
  return null
}
