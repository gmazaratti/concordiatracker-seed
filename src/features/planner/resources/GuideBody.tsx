import { Link } from 'react-router-dom'
import { ArrowRight, ArrowUpRight } from 'lucide-react'
import type { Block } from '@/data/guides'
import { findResource } from '@/data/resource-guide'
import { RESOURCE_GROUPS, type Resource } from '@/data/resources'
import { tocId } from './guide-toc'
import { GROUP_LOOK, groupOf } from './resource-icons'

/**
 * The body of a guide, set as an article: headings, paragraphs and plain
 * lists. Nothing is numbered; a run of points reads as short titled
 * paragraphs. Offices named in the text are cards that open the same sheet as
 * the directory, so reading about the Writing Centre is one tap from booking.
 */
export function GuideBody({
  body,
  faculty,
  onOpen,
}: {
  body: Block[]
  faculty: Resource['faculty'] | null
  onOpen: (r: Resource) => void
}) {
  return (
    <div className="space-y-6">
      {body.map((b, i) => (
        <BlockView key={i} b={b} i={i} first={i === 0} faculty={faculty} onOpen={onOpen} />
      ))}
    </div>
  )
}

const prose = 'text-[17px] leading-[1.75] text-fg/85 sm:text-[18px]'

function BlockView({
  b,
  i,
  first,
  faculty,
  onOpen,
}: {
  b: Block
  /** The block's place in the body: its heading ids come from it. */
  i: number
  first: boolean
  faculty: Resource['faculty'] | null
  onOpen: (r: Resource) => void
}) {
  if ('h' in b)
    return <h2 id={tocId(i)} className="scroll-mt-20 pt-6 font-display text-[26px] leading-tight font-bold tracking-tight text-fg sm:text-[30px]">{b.h}</h2>
  if ('p' in b) return <p className={first ? 'text-[19px] leading-[1.7] text-fg sm:text-[21px]' : prose}>{b.p}</p>
  if ('list' in b)
    return (
      <ul className="space-y-3 pl-1">
        {b.list.map((t) => (
          <li key={t} className={`flex gap-4 ${prose}`}>
            <span className="mt-[0.72em] h-px w-4 shrink-0 bg-border-strong" aria-hidden />
            <span>{t}</span>
          </li>
        ))}
      </ul>
    )
  if ('steps' in b)
    return (
      <div className="space-y-7">
        {b.steps.map((s, j) => (
          <section key={s.t} id={tocId(i, j)} className="scroll-mt-20">
            <h3 className="font-display text-[20px] leading-snug font-semibold text-fg sm:text-[22px]">{s.t}</h3>
            <p className={`mt-1.5 ${prose}`}>{s.d}</p>
          </section>
        ))}
      </div>
    )
  if ('tip' in b)
    return (
      <aside className="border-l-2 border-accent py-1 pl-5">
        <p className="text-[12px] font-semibold tracking-[0.12em] text-accent uppercase">In the app</p>
        <p className="mt-1 text-[16px] leading-relaxed text-fg sm:text-[17px]">{b.tip}</p>
      </aside>
    )
  if ('warn' in b)
    return (
      <aside className="border-l-2 border-warning py-1 pl-5">
        <p className="text-[12px] font-semibold tracking-[0.12em] text-warning uppercase">Careful</p>
        <p className="mt-1 text-[16px] leading-relaxed text-fg sm:text-[17px]">{b.warn}</p>
      </aside>
    )
  if ('app' in b)
    return (
      <Link
        to={b.app.to}
        className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2.5 text-[14.5px] font-semibold text-accent-contrast transition-colors duration-150 hover:bg-accent-hover"
      >
        {b.app.label} <ArrowRight size={16} aria-hidden />
      </Link>
    )
  const r = findResource(b.office, faculty)
  if (!r) return null
  const look = GROUP_LOOK[groupOf(r.name, RESOURCE_GROUPS)]
  const Icon = look.icon
  return (
    <button
      type="button"
      onClick={() => onOpen(r)}
      className="group flex w-full items-center gap-4 rounded-2xl border border-border bg-surface p-4 text-left transition-colors duration-150 hover:border-border-strong"
    >
      <span className="grid size-11 shrink-0 place-items-center rounded-full text-white" style={{ backgroundColor: look.hex }}>
        <Icon size={19} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15.5px] font-semibold text-fg">{r.name}</span>
        <span className="block truncate text-[13.5px] text-muted">
          {[r.where, r.email].filter(Boolean).join(' · ') || 'Contact details and official page'}
        </span>
      </span>
      <ArrowUpRight
        size={17}
        className="shrink-0 text-subtle transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-fg"
        aria-hidden
      />
    </button>
  )
}
