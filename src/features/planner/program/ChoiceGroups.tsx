import { Link } from 'react-router-dom'
import { ArrowRight, Shuffle, Users } from 'lucide-react'
import { normalizeCode } from '@/lib/prereq'
import type { ProgramPick } from '@/lib/programs'

interface Choice {
  id: string
  title: string
  credits: number
  rule?: string | null
  note?: string | null
}

/**
 * The requirements that are a RULE rather than a list ("24 credits from one of
 * the majors", "6 credits outside the school"). Drawn as one section of tiles,
 * each led by its credit count, instead of one wide card apiece: as separate
 * full-width cards holding a sentence each they read as empty and all alike.
 *
 * Said once at the top, not on every tile: we do not tick these off, and the
 * credits you have passed that no named course claimed are the ones that most
 * likely count here. That number is a fact; which rule it satisfies is not
 * ours to guess.
 */
export function ChoiceGroups({
  groups,
  unassigned,
  picks,
  held,
}: {
  groups: Choice[]
  /** Credits passed that no named requirement claimed. */
  unassigned: number
  picks: ProgramPick[]
  held: Set<string>
}) {
  if (groups.length === 0) return null
  const asked = groups.reduce((n, g) => n + g.credits, 0)
  const pct = asked > 0 ? Math.min(100, Math.round((unassigned / asked) * 100)) : 0
  const fresh = picks.filter((p) => !held.has(normalizeCode(p.code))).slice(0, 8)
  return (
    <section className="ct-res-in overflow-hidden rounded-3xl border border-border bg-surface">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-4 border-b border-border/70 bg-info/[0.07] p-5 sm:p-6">
        <span className="grid size-14 shrink-0 place-items-center rounded-full bg-info text-white">
          <Shuffle size={24} aria-hidden />
        </span>
        <div className="min-w-0 flex-1 basis-64">
          <h3 className="font-display text-[21px] leading-snug font-semibold text-fg">Your choices: {asked} credits</h3>
          <p className="mt-1 max-w-2xl text-[13.5px] leading-relaxed text-muted">
            These are rules, not course lists, so nothing here is ticked off for you. Check the wording against what
            you have taken, and confirm with your advisor.
          </p>
        </div>
        {/* A fact beside the rules: credits passed that no named course claimed. */}
        <div className="w-full shrink-0 sm:w-72">
          <p className="flex items-baseline justify-between gap-2 text-[13px] text-muted">
            <span>
              <span className="font-display text-[26px] leading-none font-bold text-fg tabular-nums">{unassigned}</span>{' '}
              credits passed and unclaimed
            </span>
          </p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full bg-info transition-[width] duration-700" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-1.5 text-[12px] leading-snug text-subtle">
            These most likely go toward the {asked} credits below. Which rule each one satisfies is not ours to guess.
          </p>
        </div>
      </div>

      <ul className="grid gap-px bg-border/60 sm:grid-cols-2 xl:grid-cols-3">
        {groups.map((g) => (
          <li key={g.id} className="flex flex-col bg-surface p-5">
            <div className="flex items-baseline gap-2">
              <span className="font-display text-[34px] leading-none font-bold text-fg tabular-nums">{g.credits}</span>
              <span className="text-[13px] font-medium text-subtle">credits</span>
            </div>
            <p className="mt-2 text-[16px] font-semibold text-fg">{g.title}</p>
            <p className="mt-1 text-[13.5px] leading-relaxed text-muted">{g.rule}</p>
            {g.note && <p className="mt-2 text-[12.5px] leading-relaxed text-subtle">{g.note}</p>}
          </li>
        ))}
      </ul>

      {fresh.length > 0 && (
        <div className="border-t border-border/70 p-5 sm:px-6">
          <p className="flex items-center gap-2 text-[13px] font-semibold text-fg">
            <Users size={14} className="text-subtle" aria-hidden />
            Common in your programme
          </p>
          <ul className="mt-2.5 flex flex-wrap gap-1.5">
            {fresh.map((p) => (
              <li key={p.code}>
                <Link
                  to={`/app/planner?tab=directory&q=${encodeURIComponent(p.code)}`}
                  title={p.title ?? undefined}
                  className="group inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-[13px] text-fg transition-colors duration-150 hover:border-accent"
                >
                  <span className="font-semibold">{p.code}</span>
                  <span className="text-subtle">{p.takers}</span>
                  <ArrowRight size={12} className="text-subtle transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[12px] leading-relaxed text-subtle">
            How many students in your programme have each one. Whether a course satisfies a rule above is still the
            rule's call, not ours.
          </p>
        </div>
      )}
    </section>
  )
}
