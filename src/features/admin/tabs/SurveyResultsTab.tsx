import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, Crown, Loader2, MessageSquare, Star, ThumbsUp } from 'lucide-react'
import { adminListSurveyResponses, type SurveyResponseRow } from '../admin-data'
import { RATING_QUESTIONS, TEXT_QUESTIONS } from '@/features/feedback/survey/survey-data'
import { cn } from '@/lib/cn'

/** Admin survey dashboard: headline stats, per-question rating distributions, the
 * recommend split, and a per-respondent list of who said what. */
export function SurveyResultsTab() {
  const [rows, setRows] = useState<SurveyResponseRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    void (async () => {
      try {
        const data = await adminListSurveyResponses()
        if (active) setRows(data)
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'Failed to load')
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [])

  const stats = useMemo(() => {
    const total = rows.length
    const withRec = rows.filter((r) => r.recommend !== null).length
    const yes = rows.filter((r) => r.recommend === true).length
    const rewarded = rows.filter((r) => r.rewarded).length
    const perQ = RATING_QUESTIONS.map((q) => {
      const counts = [0, 0, 0, 0, 0]
      let sum = 0
      let n = 0
      for (const r of rows) {
        const v = r.ratings?.[q.id]
        if (typeof v === 'number' && v >= 1 && v <= 5) {
          counts[v - 1]++
          sum += v
          n++
        }
      }
      return { id: q.id, label: q.label, counts, avg: n ? sum / n : 0, n }
    })
    const overall = perQ.filter((q) => q.n).reduce((s, q) => s + q.avg, 0) / (perQ.filter((q) => q.n).length || 1)
    return { total, withRec, yes, rewarded, perQ, overall }
  }, [rows])

  if (loading) {
    return (
      <div className="grid place-items-center py-16">
        <Loader2 className="size-5 animate-spin text-accent" aria-label="Loading" />
      </div>
    )
  }
  if (error) {
    return (
      <div className="rounded-xl border border-border bg-surface p-5 text-[13px] text-muted">
        Couldn&rsquo;t load survey results — {error}. If this persists, run{' '}
        <code className="rounded bg-surface-2 px-1 py-0.5 text-[12px]">db/survey_admin.sql</code> in Supabase.
      </div>
    )
  }
  if (stats.total === 0) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-8 text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-xl bg-surface-2 text-subtle">
          <MessageSquare size={22} aria-hidden />
        </span>
        <h3 className="mt-3.5 text-[15px] font-semibold text-fg">No survey responses yet</h3>
        <p className="mt-1 text-[13px] text-subtle">They&rsquo;ll appear here as students complete the survey.</p>
      </div>
    )
  }

  const recRate = stats.withRec ? Math.round((stats.yes / stats.withRec) * 100) : 0

  return (
    <div className="space-y-6">
      {/* Headline stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon={MessageSquare} label="Responses" value={String(stats.total)} />
        <Stat icon={ThumbsUp} label="Would recommend" value={`${recRate}%`} sub={`${stats.yes}/${stats.withRec}`} />
        <Stat icon={Star} label="Avg rating" value={stats.overall.toFixed(1)} sub="of 5" />
        <Stat icon={Crown} label="Pro gifted" value={String(stats.rewarded)} sub="reward claims" />
      </div>

      {/* Recommend split */}
      <Section title="Would recommend to a friend">
        <div className="flex items-center gap-3">
          <div className="flex h-6 flex-1 overflow-hidden rounded-md bg-surface-2">
            <div
              className="h-full bg-accent transition-[width] duration-500"
              style={{ width: `${recRate}%` }}
              title={`Yes: ${stats.yes}`}
            />
          </div>
          <span className="w-24 shrink-0 text-right text-[12px] tabular-nums text-muted">
            {stats.yes} yes · {stats.withRec - stats.yes} no
          </span>
        </div>
      </Section>

      {/* Rating distributions */}
      <Section title="Ratings">
        <div className="space-y-4">
          {stats.perQ.map((q) => (
            <RatingBar key={q.id} label={q.label} counts={q.counts} avg={q.avg} n={q.n} />
          ))}
        </div>
      </Section>

      {/* Per-respondent */}
      <section>
        <h2 className="mb-2.5 text-[13px] font-semibold text-fg">Who said what ({stats.total})</h2>
        <div className="space-y-2.5">
          {rows.map((r) => (
            <RespondentCard key={r.user_id} row={r} />
          ))}
        </div>
      </section>
    </div>
  )
}

function Stat({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof Star
  label: string
  value: string
  sub?: string
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3.5">
      <div className="flex items-center gap-1.5 text-subtle">
        <Icon size={14} aria-hidden />
        <span className="text-[11.5px] font-medium">{label}</span>
      </div>
      <p className="mt-1.5 text-[22px] font-semibold text-fg tabular-nums">
        {value} {sub && <span className="text-[12px] font-normal text-subtle">{sub}</span>}
      </p>
    </div>
  )
}

function RatingBar({ label, counts, avg, n }: { label: string; counts: number[]; avg: number; n: number }) {
  const max = Math.max(1, ...counts)
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="text-[13px] font-medium text-fg">{label}</span>
        <span className="shrink-0 text-[12px] tabular-nums text-muted">
          <span className="font-semibold text-fg">{avg.toFixed(1)}</span> · {n} responses
        </span>
      </div>
      {/* 1→5 distribution */}
      <div className="flex items-end gap-1.5">
        {counts.map((c, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-1">
            <div className="flex h-14 w-full items-end rounded-md bg-surface-2/60">
              <div
                className="w-full rounded-md bg-accent transition-[height] duration-500"
                style={{ height: `${(c / max) * 100}%` }}
                title={`${i + 1}★: ${c}`}
              />
            </div>
            <span className="text-[10.5px] tabular-nums text-subtle">{i + 1}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function RespondentCard({ row }: { row: SurveyResponseRow }) {
  const [open, setOpen] = useState(false)
  const name = row.name || row.email || 'Anonymous'
  const initials =
    name
      .trim()
      .split(/\s+/)
      .map((w) => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'U'
  const date = new Date(row.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })

  const texts: { label: string; value: string }[] = []
  if (row.answers?.stopped) {
    texts.push({
      label: 'Almost stopped?',
      value: row.answers.stopped === 'yes' ? `Yes — ${row.answers.stopped_detail ?? '(no detail)'}` : 'No',
    })
  }
  for (const q of TEXT_QUESTIONS) {
    const v = row.answers?.[q.id]
    if (v?.trim()) texts.push({ label: q.label, value: v })
  }

  return (
    <div className="rounded-xl border border-border bg-surface">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-3.5 py-3 text-left"
      >
        {row.avatar_url ? (
          <img src={row.avatar_url} alt="" referrerPolicy="no-referrer" className="size-8 shrink-0 rounded-full bg-surface-2 object-cover" />
        ) : (
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent-soft text-[11px] font-semibold text-accent">
            {initials}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[13px] font-medium text-fg">{name}</span>
            {row.rewarded && (
              <span className="inline-flex items-center gap-0.5 rounded bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold text-accent">
                <Crown size={10} aria-hidden /> Pro
              </span>
            )}
          </div>
          <span className="block truncate text-[11.5px] text-subtle">
            {row.handle ? `@${row.handle}` : row.email} · {date}
          </span>
        </div>
        {row.recommend !== null && (
          <span
            className={cn(
              'shrink-0 rounded-md px-2 py-0.5 text-[11px] font-medium',
              row.recommend ? 'bg-success/15 text-success' : 'bg-surface-2 text-subtle',
            )}
          >
            {row.recommend ? 'Recommends' : "Wouldn't"}
          </span>
        )}
        <ChevronDown size={16} className={cn('shrink-0 text-subtle transition-transform', open && 'rotate-180')} aria-hidden />
      </button>

      {open && (
        <div className="border-t border-border px-3.5 py-3">
          {/* Rating chips */}
          <div className="flex flex-wrap gap-1.5">
            {RATING_QUESTIONS.map((q) => {
              const v = row.ratings?.[q.id]
              if (typeof v !== 'number') return null
              return (
                <span key={q.id} className="rounded-md bg-surface-2 px-2 py-0.5 text-[11px] text-muted">
                  {shortLabel(q.id)} <span className="font-semibold text-fg tabular-nums">{v}</span>
                </span>
              )
            })}
          </div>
          {/* Free text */}
          {texts.length > 0 && (
            <dl className="mt-3 space-y-2.5">
              {texts.map((t, i) => (
                <div key={i}>
                  <dt className="text-[11.5px] font-medium text-subtle">{t.label}</dt>
                  <dd className="mt-0.5 text-[13px] whitespace-pre-line text-fg">{t.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      )}
    </div>
  )
}

/** Compact labels for the rating chips. */
const SHORT: Record<string, string> = {
  onboarding: 'Onboarding',
  ease: 'Ease',
  convenience: 'Convenience',
  uniqueness: 'Uniqueness',
  price: 'Price',
  keep_using: 'Keep using',
}
function shortLabel(id: string): string {
  return SHORT[id] ?? id
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2.5 text-[13px] font-semibold text-fg">{title}</h2>
      <div className="rounded-xl border border-border bg-surface p-4">{children}</div>
    </section>
  )
}
