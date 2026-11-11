import { useState } from 'react'
import { ArrowUpRight, CalendarCheck, Check, Copy, Star } from 'lucide-react'
import { ADVISORS, type Advisor } from '@/data/advisors'
import type { Resource } from '@/data/resources'
import { cn } from '@/lib/cn'

type Faculty = NonNullable<Resource['faculty']>

const FACULTIES: { id: Faculty; label: string }[] = [
  { id: 'jmsb', label: 'John Molson' },
  { id: 'ginacody', label: 'Gina Cody' },
  { id: 'artsci', label: 'Arts and Science' },
  { id: 'finearts', label: 'Fine Arts' },
]

/**
 * The people, not the office: the advisors a faculty names on its own page.
 * Yours (matched on your program) leads. Other faculties are one tap away,
 * because "which office is mine" is itself a common question.
 */
export function AdvisorStrip({
  mine,
  program,
  onOffice,
}: {
  mine: Faculty | null
  program: string
  onOffice: (f: Faculty) => void
}) {
  const [picked, setPicked] = useState<Faculty | null>(null)
  const faculty = picked ?? mine ?? 'jmsb'
  const list = ADVISORS[faculty]
  const isYours = (a: Advisor) => faculty === mine && !!a.match && !!program && a.match.test(program)
  const people = [...list.people].sort((a, b) => Number(isYours(b)) - Number(isYours(a)))

  return (
    <section aria-labelledby="res-advisors">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h3 id="res-advisors" className="font-display text-[22px] font-semibold tracking-tight text-fg">
            {faculty === mine ? 'Your advisors' : 'Advisors'}
          </h3>
          <p className="mt-0.5 max-w-xl text-[13px] text-muted">{list.note}</p>
        </div>
        <div role="tablist" aria-label="Faculty" className="flex flex-wrap gap-1.5">
          {FACULTIES.map((f) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={faculty === f.id}
              onClick={() => setPicked(f.id)}
              className={cn(
                'rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition-colors duration-150',
                faculty === f.id
                  ? 'border-accent bg-accent-soft text-fg'
                  : 'border-border text-muted hover:border-border-strong hover:text-fg',
              )}
            >
              {f.label}
              {f.id === mine && <span className="ml-1 text-accent">· yours</span>}
            </button>
          ))}
        </div>
      </div>

      <div key={faculty} className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {people.map((a, i) => (
          <Person key={a.email} a={a} yours={isYours(a)} delay={i * 50} />
        ))}
        <button
          type="button"
          onClick={() => onOffice(faculty)}
          className="ct-res-in group flex min-h-[112px] flex-col justify-between rounded-2xl border border-dashed border-border-strong p-4 text-left transition-colors duration-150 hover:border-accent hover:bg-accent-soft/40"
          style={{ animationDelay: `${people.length * 50}ms` }}
        >
          <span className="text-[14px] font-semibold text-fg">
            {people.length ? 'Not sure who to write to?' : 'Write to the advising office'}
          </span>
          <span className="inline-flex items-center gap-1 text-[12.5px] font-medium text-accent">
            Office address, hours and front desk
            <ArrowUpRight size={13} className="transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden />
          </span>
        </button>
      </div>
      <p className="mt-2.5 text-[11.5px] text-subtle">
        Names from{' '}
        <a href={list.source} target="_blank" rel="noreferrer noopener" className="underline underline-offset-2 hover:text-fg">
          the faculty’s own advising page
        </a>
        , November 2026. Advisors change between terms; that page is always current.
      </p>
    </section>
  )
}

function Person({ a, yours, delay }: { a: Advisor; yours: boolean; delay: number }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard
      ?.writeText(a.email)
      .then(() => {
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1600)
      })
      .catch(() => {})
  }
  return (
    <article
      className={cn(
        'ct-res-in flex gap-3.5 rounded-2xl border bg-surface p-4 transition-[border-color,transform] duration-200 hover:-translate-y-0.5',
        yours ? 'border-accent/60' : 'border-border hover:border-border-strong',
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      <Face a={a} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <h4 className="text-[14.5px] font-semibold text-fg">{a.name}</h4>
          {yours && (
            <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent">
              <Star size={10} aria-hidden /> Your program
            </span>
          )}
        </div>
        <p className="mt-0.5 line-clamp-2 text-[12.5px] leading-snug text-muted">{a.role}</p>
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={copy}
            title={a.email}
            className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-border px-2 py-1 text-[12px] font-medium text-fg transition-colors duration-150 hover:border-border-strong hover:bg-surface-2"
          >
            {copied ? <Check size={12} className="text-success" aria-hidden /> : <Copy size={12} className="text-subtle" aria-hidden />}
            <span className="truncate">{copied ? 'Copied' : a.email}</span>
          </button>
          {a.bookUrl && (
            <a
              href={a.bookUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-2.5 py-1 text-[12px] font-semibold text-accent-contrast transition-colors duration-150 hover:bg-accent-hover"
            >
              <CalendarCheck size={12} aria-hidden /> Book
            </a>
          )}
        </div>
        {a.phone && <p className="mt-1.5 text-[11.5px] text-subtle">{a.phone}</p>}
      </div>
    </article>
  )
}

/** The published portrait, or initials when there is none or it has moved. */
function Face({ a }: { a: Advisor }) {
  const [failed, setFailed] = useState(false)
  const initials = a.name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
  return (
    <span className="relative grid size-14 shrink-0 place-items-center overflow-hidden rounded-full bg-accent-soft text-[16px] font-semibold text-accent ring-2 ring-border">
      {initials}
      {a.photo && !failed && (
        <img
          src={a.photo}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="absolute inset-0 size-full object-cover"
        />
      )}
    </span>
  )
}
