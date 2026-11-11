import { Link } from 'react-router-dom'
import { Check, FileText, Info, Loader2, Users } from 'lucide-react'
import { cn } from '@/lib/cn'
import { normalizeCode } from '@/lib/prereq'
import type { ProgramPick } from '@/lib/programs'

interface ReqCourse {
  code: string
  title: string
  credits: number
}

interface Group {
  id: string
  title: string
  kind: 'all' | 'credits'
  credits: number
  rule?: string | null
  note?: string | null
}

/**
 * One requirement group. The tick tiles are the part people liked and are kept
 * as they were in shape (green passed, amber in progress, plain not taken),
 * only larger and inside a card that states its own progress: a ring with the
 * share done, and the credits beside it.
 */
export function GroupCard({
  group,
  done,
  remaining,
  earnedCredits,
  counted,
  inProgress,
  picks,
  held,
  delay,
  compact,
}: {
  group: Group
  done: ReqCourse[]
  remaining: ReqCourse[]
  earnedCredits: number
  counted: boolean
  inProgress: Set<string>
  picks: ProgramPick[]
  held: Set<string>
  delay: number
  /** A short list: half the row on a wide screen, and tiles two across. */
  compact?: boolean
}) {
  const pct = counted && group.credits > 0 ? Math.min(100, Math.round((earnedCredits / group.credits) * 100)) : 0
  const complete = counted && pct >= 100
  return (
    <section
      className={cn('ct-res-in rounded-3xl border border-border bg-surface p-5 sm:p-6', !compact && 'xl:col-span-2')}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center gap-4">
        {counted ? (
          <Ring pct={pct} complete={complete} />
        ) : (
          <span className="grid size-14 shrink-0 place-items-center rounded-full bg-surface-2 text-muted">
            <FileText size={22} aria-hidden />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-[19px] leading-snug font-semibold text-balance text-fg sm:text-[21px]">{group.title}</h3>
          <p className="mt-0.5 text-[13.5px] text-muted">
            {counted ? (
              <>
                <span className="font-semibold text-fg tabular-nums">{earnedCredits}</span> of {group.credits} credits
              </>
            ) : (
              <>{group.credits} credits, by the calendar's rule</>
            )}
          </p>
        </div>
        {complete ? (
          <span className="hidden rounded-full bg-success px-3 py-1 text-[12px] font-semibold text-white sm:inline-block">Complete</span>
        ) : (
          counted &&
          group.kind === 'all' &&
          remaining.length > 0 && (
            // What is left is the part to act on, so it is the loudest thing in the header.
            <span className="shrink-0 rounded-full bg-warning/15 px-3 py-1 text-[12.5px] font-semibold whitespace-nowrap text-warning">
              {remaining.length} to go
            </span>
          )
        )}
      </div>

      {counted ? (
        <>
          <ul className={cn('mt-5 grid gap-2 sm:grid-cols-2', !compact && 'xl:grid-cols-3')}>
            {(group.kind === 'all' ? [...done, ...remaining] : done).map((course) => {
              const isDone = done.includes(course)
              const taking = !isDone && inProgress.has(normalizeCode(course.code))
              return (
                <li
                  key={course.code}
                  title={isDone ? 'Passed' : taking ? 'On your schedule this term' : 'Not taken yet'}
                  className={cn(
                    'flex items-start gap-3 rounded-2xl border px-3.5 py-3',
                    isDone ? 'border-success/40 bg-success/10' : taking ? 'border-warning/40 bg-warning/10' : 'border-border bg-canvas/60',
                  )}
                >
                  <span
                    className={cn(
                      'mt-0.5 grid size-[22px] shrink-0 place-items-center rounded-full border-2',
                      isDone ? 'border-success bg-success' : taking ? 'border-warning bg-warning' : 'border-border-strong',
                    )}
                    aria-hidden
                  >
                    {isDone && <Check size={13} strokeWidth={3} className="text-canvas" />}
                    {taking && <Loader2 size={12} className="animate-spin text-canvas" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="text-[14.5px] font-semibold text-fg">{course.code}</span>
                      <span className="shrink-0 text-[12px] text-subtle tabular-nums">{course.credits} cr</span>
                    </span>
                    <span className="mt-0.5 block text-[13px] leading-snug text-muted">{course.title}</span>
                  </span>
                </li>
              )
            })}
          </ul>
          {/* "N credits chosen from": the passed ones above, the list folded away (it can run to sixty courses). */}
          {group.kind === 'credits' && remaining.length > 0 && (
            <details className="mt-3 rounded-2xl bg-canvas/60 px-4 py-3">
              <summary className="cursor-pointer text-[13.5px] font-semibold text-fg">Choose from {remaining.length} courses</summary>
              {group.rule && <p className="mt-2 text-[13px] leading-relaxed text-muted">{group.rule}</p>}
              <ul className="mt-2 grid gap-x-4 gap-y-1.5 sm:grid-cols-2 xl:grid-cols-3">
                {remaining.map((course) => (
                  <li key={course.code} className="text-[13px] text-muted">
                    <span className="font-semibold text-fg">{course.code}</span> {course.title}{' '}
                    <span className="text-subtle">({course.credits})</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      ) : (
        <div className="mt-5 rounded-2xl bg-canvas/60 px-4 py-3.5">
          <p className="text-[14px] leading-relaxed text-fg/90">{group.rule}</p>
          <p className="mt-2 text-[12.5px] text-subtle">
            Not ticked off automatically. Which courses satisfy this depends on wording we will not guess at.
          </p>
          <Picks picks={picks} mine={held} />
        </div>
      )}

      {group.note && (
        <p className="mt-3 flex items-start gap-2 text-[12.5px] leading-relaxed text-subtle">
          <Info size={14} className="mt-0.5 shrink-0" aria-hidden />
          {group.note}
        </p>
      )}
    </section>
  )
}

/** The share of a group that is done, as a ring. Drawn with two circles; no chart library. */
function Ring({ pct, complete }: { pct: number; complete: boolean }) {
  const r = 24
  const c = 2 * Math.PI * r
  return (
    <span className="relative grid size-14 shrink-0 place-items-center" aria-hidden>
      <svg viewBox="0 0 56 56" className="absolute inset-0 -rotate-90">
        <circle cx="28" cy="28" r={r} fill="none" strokeWidth="5" className="stroke-surface-2" />
        <circle
          cx="28"
          cy="28"
          r={r}
          fill="none"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct / 100)}
          className={cn('transition-[stroke-dashoffset] duration-700', complete ? 'stroke-success' : 'stroke-accent')}
        />
      </svg>
      {complete ? (
        <Check size={20} strokeWidth={3} className="text-success" />
      ) : (
        <span className="text-[13px] font-bold text-fg tabular-nums">{pct}%</span>
      )}
    </span>
  )
}

/**
 * What other people in this programme are registered in.
 *
 * A FACT, PRESENTED AS ONE. It is not a reading of the rule above it and the
 * copy says so. This says "these are common", never "these count". Hidden
 * below three takers (the server enforces it too) and when everything popular
 * is already yours, because a suggestion list of things you have done is noise.
 */
function Picks({ picks, mine }: { picks: ProgramPick[]; mine: Set<string> }) {
  const fresh = picks.filter((p) => !mine.has(normalizeCode(p.code))).slice(0, 6)
  if (fresh.length === 0) return null
  return (
    <div className="mt-3.5 border-t border-border pt-3">
      <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-muted">
        <Users size={13} aria-hidden />
        Common in your programme
      </p>
      <ul className="mt-2 flex flex-wrap gap-1.5">
        {fresh.map((p) => (
          <li key={p.code}>
            <Link
              to={`/app/planner?tab=directory&q=${encodeURIComponent(p.code)}`}
              title={p.title ?? undefined}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-[13px] text-fg transition-colors duration-150 hover:border-accent"
            >
              <span className="font-semibold">{p.code}</span>
              <span className="text-subtle">{p.takers}</span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[12px] leading-relaxed text-subtle">
        How many students in your programme have each one. Whether it satisfies the rule above is still the rule's call,
        not ours.
      </p>
    </div>
  )
}
