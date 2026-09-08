import { useEffect, useState } from 'react'
import { ChevronDown, Loader2, Mail, MessageSquare } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  CHOICE_QUESTIONS,
  RATING_QUESTIONS,
  TEXT_QUESTIONS,
} from '@/features/survey/public-survey'
import { cn } from '@/lib/cn'

interface Row {
  id: string
  ratings: Record<string, number>
  answers: Record<string, string>
  email: string | null
  source: string | null
  created_at: string
  outline_files?: { path: string; name: string }[]
  converted?: boolean
}
interface Data {
  responses: number
  emails: number
  /** Responses that were ISSUED a trial link — the honest conversion
   *  denominator, since rows from before that feature never had the chance. */
  claimable: number
  /** Of those, the ones where an account was actually created through it. */
  converted: number
  with_outline: number
  outline_files: number
  sources: { source: string; n: number }[]
  averages: Record<string, number>
  /** questionId -> { option -> count } */
  choices: Record<string, Record<string, number>>
  rows: Row[]
}

/** Results from the public /survey (non-users), inside the admin console. */
export function PublicSurveyResults() {
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  useEffect(() => {
    let active = true
    void (async () => {
      const { data: res, error } = await supabase.rpc('admin_public_survey')
      if (!active) return
      if (error) setErr(error.message)
      else setData(res as Data)
      setLoading(false)
    })()
    return () => {
      active = false
    }
  }, [])

  if (loading) {
    return (
      <div className="grid place-items-center py-16">
        <Loader2 className="size-5 animate-spin text-accent" aria-label="Loading" />
      </div>
    )
  }
  if (err || !data) {
    return (
      <div className="rounded-xl border border-border bg-surface p-5 text-[13px] text-muted">
        Couldn&rsquo;t load{err ? `: ${err}` : ''}. If this persists, run{' '}
        <code className="rounded bg-surface-2 px-1 py-0.5 text-[12px]">db/survey_fix.sql</code>.
        <span className="mt-1.5 block text-[12px] text-subtle">
          Responses are still being recorded either way &mdash; this page is the reader, not the
          writer.
        </span>
      </div>
    )
  }
  if (data.responses === 0) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-8 text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-xl bg-surface-2 text-subtle">
          <MessageSquare size={22} aria-hidden />
        </span>
        <h3 className="mt-3.5 text-[15px] font-semibold text-fg">No responses yet</h3>
        <p className="mx-auto mt-1 max-w-sm text-[13px] leading-relaxed text-subtle">
          Share <code className="rounded bg-surface-2 px-1">concordiatracker.com/survey</code>: add{' '}
          <code className="rounded bg-surface-2 px-1">?src=instagram</code> to see which channel each
          response came from.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="Responses" value={String(data.responses)} />
        {/* The number the survey exists to produce. Denominator is `claimable`,
            not `responses`, because a response issued no link could never have
            converted through one — counting it as a failure would understate
            the rate for no reason. */}
        <Stat
          label="Signed up"
          value={
            data.claimable > 0
              ? `${Math.round((data.converted / data.claimable) * 100)}%`
              : '—'
          }
          sub={data.claimable > 0 ? `${data.converted} of ${data.claimable}` : 'no links issued yet'}
        />
        <Stat label="Left an email" value={String(data.emails)} sub="wants early access" />
        <Stat
          label="Shared an outline"
          value={String(data.with_outline)}
          sub={data.outline_files > 0 ? `${data.outline_files} files` : undefined}
        />
        <Stat
          label="Top source"
          value={data.sources[0]?.source ?? '—'}
          sub={data.sources[0] ? `${data.sources[0].n} responses` : undefined}
        />
      </div>

      <section>
        <h3 className="mb-2.5 text-[13px] font-semibold text-fg">Average scores (1–5)</h3>
        <div className="space-y-2.5 rounded-xl border border-border bg-surface p-4">
          {RATING_QUESTIONS.map((q) => {
            const avg = data.averages[q.id]
            if (avg == null) return null
            return (
              <div key={q.id} className="flex items-center gap-3">
                <span className="min-w-0 flex-1 truncate text-[12.5px] text-fg" title={q.label}>
                  {q.label}
                </span>
                <div className="h-2 w-28 shrink-0 overflow-hidden rounded-full bg-surface-2">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${(avg / 5) * 100}%` }} />
                </div>
                <span className="w-8 shrink-0 text-right text-[12.5px] font-semibold tabular-nums text-fg">
                  {avg.toFixed(1)}
                </span>
              </div>
            )
          })}
        </div>
      </section>

      {/* Choice questions as tallies. Reading "would you support us seeking
          Concordia funding" by eye down 200 cards is not reading it. */}
      <section>
        <h3 className="mb-2.5 text-[13px] font-semibold text-fg">Answers</h3>
        <div className="space-y-4 rounded-xl border border-border bg-surface p-4">
          {CHOICE_QUESTIONS.map((q) => {
            const tally = data.choices?.[q.id]
            if (!tally) return null
            const total = Object.values(tally).reduce((a, b) => a + b, 0)
            if (total === 0) return null
            return (
              <div key={q.id}>
                <p className="text-[12.5px] font-medium text-fg">{q.label}</p>
                <div className="mt-1.5 space-y-1">
                  {q.options
                    .map((opt) => [opt, tally[opt] ?? 0] as const)
                    .sort((a, b) => b[1] - a[1])
                    .map(([opt, n]) => (
                      <div key={opt} className="flex items-center gap-2.5">
                        <span className="w-40 shrink-0 truncate text-[12px] text-muted" title={opt}>
                          {opt}
                        </span>
                        <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-2">
                          <div
                            className="h-full rounded-full bg-accent"
                            style={{ width: `${total ? (n / total) * 100 : 0}%` }}
                          />
                        </div>
                        <span className="w-8 shrink-0 text-right text-[12px] tabular-nums text-fg">
                          {n}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <section>
        <h3 className="mb-2.5 text-[13px] font-semibold text-fg">Responses ({data.rows.length})</h3>
        <div className="space-y-2">
          {data.rows.map((r) => (
            <ResponseCard key={r.id} row={r} />
          ))}
        </div>
      </section>
    </div>
  )
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3.5">
      <p className="text-[11.5px] font-medium text-subtle">{label}</p>
      <p className="mt-1 truncate text-[20px] font-semibold text-fg">{value}</p>
      {sub && <p className="text-[11px] text-subtle">{sub}</p>}
    </div>
  )
}

function ResponseCard({ row }: { row: Row }) {
  const [open, setOpen] = useState(false)
  const date = new Date(row.created_at).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
  const headline = row.answers.frustration || row.answers.wish || '(no written answer)'

  return (
    <div className="rounded-xl border border-border bg-surface">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-3.5 py-3 text-left"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] text-fg">{headline}</p>
          <p className="mt-0.5 truncate text-[11.5px] text-subtle">
            {date}
            {row.source && ` · ${row.source}`}
            {row.answers.year && ` · ${row.answers.year} year`}
            {row.answers.faculty && ` · ${row.answers.faculty}`}
          </p>
        </div>
        {row.email && <Mail size={13} className="shrink-0 text-accent" aria-label="Left an email" />}
        <ChevronDown size={16} className={cn('shrink-0 text-subtle transition-transform', open && 'rotate-180')} aria-hidden />
      </button>

      {open && (
        <div className="space-y-3 border-t border-border px-3.5 py-3">
          <div className="flex flex-wrap gap-1.5">
            {RATING_QUESTIONS.map((q) => {
              const v = row.ratings[q.id]
              if (typeof v !== 'number') return null
              return (
                <span key={q.id} className="rounded-md bg-surface-2 px-2 py-0.5 text-[11px] text-muted">
                  {q.id} <span className="font-semibold text-fg tabular-nums">{v}</span>
                </span>
              )
            })}
          </div>
          <dl className="space-y-2.5">
            {CHOICE_QUESTIONS.map((q) => {
              const v = row.answers[q.id]
              if (!v) return null
              return (
                <div key={q.id}>
                  <dt className="text-[11.5px] font-medium text-subtle">{q.label}</dt>
                  <dd className="mt-0.5 text-[13px] text-fg">{v.split('|').join(', ')}</dd>
                </div>
              )
            })}
            {TEXT_QUESTIONS.map((q) => {
              const v = row.answers[q.id]
              if (!v) return null
              return (
                <div key={q.id}>
                  <dt className="text-[11.5px] font-medium text-subtle">{q.label}</dt>
                  <dd className="mt-0.5 text-[13px] whitespace-pre-line text-fg">{v}</dd>
                </div>
              )
            })}
            {row.email && (
              <div>
                <dt className="text-[11.5px] font-medium text-subtle">Email</dt>
                <dd className="mt-0.5 text-[13px] text-accent">{row.email}</dd>
              </div>
            )}
          </dl>
        </div>
      )}
    </div>
  )
}
