import { useMemo } from 'react'
import { Briefcase, ExternalLink } from 'lucide-react'
import type { Assessment, Course } from '@/data/types'
import { gpaLines } from '@/lib/gpa'
import { termRank } from '@/lib/term'
import { coopRule, recentGpa } from '@/lib/coop'
import { cn } from '@/lib/cn'

/**
 * "Am I eligible for co-op?" (asked by a co-op student, TKT-1034).
 *
 * Concordia decides on the CUMULATIVE GPA, against a threshold that depends on
 * the faculty (and, in Arts and Science, the program). That is the headline.
 * The GPA over the last 24 credits is shown underneath because it is the
 * number students track, but it is labelled as ours: no rule we could find
 * uses it. When we do not know the faculty's threshold, the card says so
 * rather than inventing one.
 */
export function CoopCard({
  pastCourses,
  assessments,
  gpa,
  faculty,
  program,
}: {
  pastCourses: Course[]
  assessments: Assessment[]
  /** The cumulative GPA as shown everywhere else (demo-flattering included). */
  gpa: number | null
  faculty: string | null
  program: string | null
}) {
  const rule = coopRule(faculty, program)
  const recent = useMemo(() => {
    const lines = gpaLines(pastCourses, assessments).map((l) => ({
      credits: l.credits,
      points: l.points,
      rank: termRank(l.course.term),
      graded: l.percent !== null,
      superseded: l.superseded,
    }))
    return recentGpa(lines, 24)
  }, [pastCourses, assessments])

  if (gpa === null) return null
  const meets = rule ? gpa >= rule.entry : null
  const keeps = rule ? gpa >= rule.stay : null

  return (
    <section className="mt-4 rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center gap-2">
        <Briefcase size={15} className="text-accent" aria-hidden />
        <h3 className="text-[13px] font-semibold text-fg">Co-op eligibility</h3>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-canvas px-3 py-2.5">
          <p className="text-[11px] tracking-wide text-subtle uppercase">Cumulative GPA</p>
          <p className="mt-0.5 font-display text-[22px] leading-none font-semibold text-fg tabular-nums">
            {gpa.toFixed(2)}
          </p>
          {rule ? (
            <p className={cn('mt-1.5 text-[12px] font-medium', meets ? 'text-success' : keeps ? 'text-warning' : 'text-danger')}>
              {meets
                ? `Meets the ${rule.entry.toFixed(2)} needed to apply`
                : keeps
                  ? `Enough to stay in co-op (${rule.stay.toFixed(2)}), below the ${rule.entry.toFixed(2)} to apply`
                  : `Below the ${rule.stay.toFixed(2)} co-op needs`}
            </p>
          ) : (
            <p className="mt-1.5 text-[12px] text-subtle">
              We do not have your faculty&rsquo;s co-op threshold. Pick your programme in My programme, or check
              the co-op page.
            </p>
          )}
        </div>

        <div className="rounded-lg border border-border bg-canvas px-3 py-2.5">
          <p className="text-[11px] tracking-wide text-subtle uppercase">Last 24 credits</p>
          <p className="mt-0.5 font-display text-[22px] leading-none font-semibold text-fg tabular-nums">
            {recent ? recent.gpa.toFixed(2) : '—'}
          </p>
          <p className="mt-1.5 text-[12px] text-subtle">
            {recent
              ? `Your most recent ${recent.credits} graded credits. A trend, not the number co-op uses.`
              : 'Add grades to past courses to see it.'}
          </p>
        </div>
      </div>

      <p className="mt-3 flex flex-wrap items-center gap-x-2 text-[11.5px] leading-relaxed text-subtle">
        <span>
          Co-op admission is competitive, and the co-op office makes the final call. Engineering and Computer
          Science need 2.50; JMSB needs 3.00 to apply and 2.70 to stay.
        </span>
        <a
          href={rule?.source ?? 'https://www.concordia.ca/academics/co-op/programs/undergraduate.html'}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex items-center gap-1 text-accent hover:underline"
        >
          Co-op requirements <ExternalLink size={11} aria-hidden />
        </a>
      </p>
    </section>
  )
}
