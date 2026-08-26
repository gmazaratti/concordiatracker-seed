import { useEffect, useState } from 'react'
import { GraduationCap, KeyRound, Layers, Loader2 } from 'lucide-react'
import { cn } from '@/lib/cn'
import { recommend, type Suggestion } from '@/lib/recommend'
import type { ProgramWithGroups } from '@/lib/program-progress'
import { browseCourses } from '@/lib/catalog'

/**
 * "Nothing in mind? Here's what you still need."
 *
 * Shown when the search box is EMPTY, which is the whole design. This is not a
 * recommendation engine pushing courses at someone who already knows what they
 * want — it is the answer to a blank search, for the student who opened the
 * planner without a plan. The moment they type, it gets out of the way.
 *
 * Nothing here says "you should take this". Every row says why it appeared, in
 * terms the student could go and check in the calendar themselves: it is
 * required, it fills an elective bucket, or its prerequisites mention something
 * they have passed. The third of those is a guess and is labelled as one.
 */
const META: Record<
  Suggestion['reason'],
  { icon: typeof GraduationCap; label: string; tone: string }
> = {
  required: { icon: GraduationCap, label: 'Required', tone: 'text-accent' },
  elective: { icon: Layers, label: 'Counts toward', tone: 'text-info' },
  unlocks: { icon: KeyRound, label: 'Maybe open to you', tone: 'text-subtle' },
}

export function SuggestedCourses({
  program,
  taken,
  offeredCodes,
  onPick,
  onHover,
  limit = 8,
}: {
  program: ProgramWithGroups | null
  /** Passed AND currently registered — neither should be suggested back. */
  taken: string[]
  offeredCodes?: string[]
  onPick: (code: string) => void
  /** Hovering previews the course on the week grid. Null on leave. */
  onHover?: (code: string | null) => void
  limit?: number
}) {
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null)

  useEffect(() => {
    if (!program) {
      // No programme on file means no requirements to reason from, and the
      // unlocks heuristic on its own is not worth a panel.
      const id = window.setTimeout(() => setSuggestions([]), 0)
      return () => window.clearTimeout(id)
    }
    let alive = true
    // Only the subjects this programme actually touches — pulling 7,884 courses
    // to suggest eight of them would be the wrong trade for a panel nobody has
    // asked a question of yet.
    const subjects = [
      ...new Set(
        program.groups.flatMap((g) => [
          ...(g.pattern ? [g.pattern.subject] : []),
          ...g.courses.map((c) => c.code.split(/[\s-]/)[0]),
        ]),
      ),
    ]
    void browseCourses({ subjects, limit: 400 })
      .then(({ rows }) => {
        if (!alive) return
        setSuggestions(
          recommend(
            {
              program,
              taken,
              offeredCodes,
              catalog: rows.map((r) => ({
                subject: r.subject,
                catalog: r.catalog,
                title: r.title,
                credits: r.class_unit ?? 3,
                prerequisites: r.description ?? null,
              })),
            },
            limit,
          ),
        )
      })
      .catch(() => alive && setSuggestions([]))
    return () => {
      alive = false
    }
  }, [program, taken, offeredCodes, limit])

  if (!program) return null

  if (suggestions === null) {
    return (
      <div className="flex items-center gap-2 px-1 py-3 text-[12px] text-subtle">
        <Loader2 size={13} className="animate-spin" aria-hidden />
        Working out what you still need…
      </div>
    )
  }
  if (suggestions.length === 0) return null

  return (
    <div className="mt-3 border-t border-border pt-3" onMouseLeave={() => onHover?.(null)}>
      <p className="mb-1.5 px-1 text-[11px] font-semibold tracking-wide text-subtle uppercase">
        Nothing in mind?
      </p>
      <p className="mb-2 px-1 text-[11.5px] leading-relaxed text-subtle">
        Not advice — just what&rsquo;s still outstanding on {program.name}.
      </p>
      <ul className="space-y-0.5">
        {suggestions.map((s) => {
          const m = META[s.reason]
          const Icon = m.icon
          return (
            <li key={s.code}>
              <button
                type="button"
                onClick={() => onPick(s.code)}
                onMouseEnter={() => onHover?.(s.code)}
                onFocus={() => onHover?.(s.code)}
                className="w-full rounded-lg px-2 py-1.5 text-left transition-colors duration-150 hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none"
              >
                <span className="flex items-baseline gap-2">
                  <span className="text-[12.5px] font-semibold text-fg">{s.code}</span>
                  <span className="min-w-0 flex-1 truncate text-[11.5px] text-muted">
                    {s.title}
                  </span>
                  {s.offered === false && (
                    <span className="shrink-0 text-[10.5px] text-subtle">not offered</span>
                  )}
                </span>
                <span className={cn('mt-0.5 flex items-center gap-1 text-[11px]', m.tone)}>
                  <Icon size={11} aria-hidden className="shrink-0" />
                  <span className="truncate">{s.because}</span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      {suggestions.some((s) => s.reason === 'unlocks') && (
        // The one line that keeps the heuristic honest. We read course codes out
        // of prerequisite prose; we do not read the "and", "or" or "one of"
        // between them, so this can only ever be a maybe.
        <p className="mt-2 px-1 text-[11px] leading-relaxed text-subtle">
          &ldquo;Maybe open to you&rdquo; means a prerequisite mentions a course you have passed.
          We don&rsquo;t read the rules between them &mdash; check the calendar before you register.
        </p>
      )}
    </div>
  )
}
