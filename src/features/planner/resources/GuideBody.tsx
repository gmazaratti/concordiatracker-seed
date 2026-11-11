import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowRight, ArrowUpRight, Check, Lightbulb } from 'lucide-react'
import type { Block } from '@/data/guides'
import { findResource } from '@/data/resource-guide'
import { RESOURCE_GROUPS, type Resource } from '@/data/resources'
import { tocId } from './guide-toc'
import { GROUP_LOOK, groupOf, wash } from './resource-icons'

/**
 * The body of a guide, set as an article whose parts look different from each
 * other, so the eye has landmarks: a section opens with a coloured rule, a run
 * of points is a stack of cards with a coloured edge, a list is ticked, and
 * the two kinds of aside (in the app / careful) are filled panels. Nothing is
 * numbered. Offices named in the text are cards that open the same sheet as
 * the directory, so reading about the Writing Centre is one tap from booking.
 */
export function GuideBody({
  body,
  hex,
  faculty,
  onOpen,
}: {
  body: Block[]
  /** The guide's own colour, used for its rules, edges and ticks. */
  hex: string
  faculty: Resource['faculty'] | null
  onOpen: (r: Resource) => void
}) {
  return (
    <div className="space-y-6">
      {body.map((b, i) => (
        <BlockView key={i} b={b} i={i} first={i === 0} hex={hex} faculty={faculty} onOpen={onOpen} />
      ))}
    </div>
  )
}

const prose = 'text-[17px] leading-[1.75] text-fg/85 sm:text-[18px]'

function BlockView({
  b,
  i,
  first,
  hex,
  faculty,
  onOpen,
}: {
  b: Block
  /** The block's place in the body: its heading ids come from it. */
  i: number
  first: boolean
  hex: string
  faculty: Resource['faculty'] | null
  onOpen: (r: Resource) => void
}) {
  if ('h' in b)
    return (
      <h2 id={tocId(i)} className="scroll-mt-20 pt-8 font-display text-[28px] leading-tight font-bold tracking-tight text-fg sm:text-[32px]">
        <span aria-hidden className="mb-4 block h-1 w-12 rounded-full" style={{ backgroundColor: hex }} />
        {b.h}
      </h2>
    )
  if ('p' in b)
    return first ? (
      // The opening paragraph is the standfirst: larger, with the guide's colour beside it.
      <p className="border-l-[3px] py-1 pl-5 text-[20px] leading-[1.6] font-medium text-fg sm:text-[22px]" style={{ borderColor: hex }}>
        {b.p}
      </p>
    ) : (
      <p className={prose}>{b.p}</p>
    )
  if ('list' in b)
    return (
      <ul className="space-y-2.5 rounded-3xl border border-border bg-surface p-5 sm:p-6">
        {b.list.map((t) => (
          <li key={t} className="flex gap-3.5 text-[16px] leading-relaxed text-fg/90 sm:text-[17px]">
            <span className="mt-1 grid size-5 shrink-0 place-items-center rounded-full text-white" style={{ backgroundColor: hex }}>
              <Check size={12} strokeWidth={3.5} aria-hidden />
            </span>
            <span>{t}</span>
          </li>
        ))}
      </ul>
    )
  if ('steps' in b)
    return (
      <div className="grid gap-3">
        {b.steps.map((s, j) => (
          <section
            key={s.t}
            id={tocId(i, j)}
            className="relative scroll-mt-20 overflow-hidden rounded-3xl border border-border bg-surface py-5 pr-5 pl-7 sm:py-6 sm:pr-6 sm:pl-8"
          >
            <span aria-hidden className="absolute inset-y-0 left-0 w-1.5" style={{ backgroundColor: hex }} />
            <h3 className="font-display text-[20px] leading-snug font-bold text-fg sm:text-[22px]">{s.t}</h3>
            <p className="mt-1.5 text-[16px] leading-[1.7] text-fg/80 sm:text-[17px]">{s.d}</p>
          </section>
        ))}
      </div>
    )
  if ('tip' in b)
    return (
      <aside className="flex gap-3.5 rounded-3xl bg-accent-soft p-5">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-accent-contrast">
          <Lightbulb size={17} aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-[12px] font-bold tracking-[0.12em] text-accent uppercase">In the app</p>
          <p className="mt-0.5 text-[16px] leading-relaxed text-fg">{b.tip}</p>
        </div>
      </aside>
    )
  if ('warn' in b)
    return (
      <aside className="flex gap-3.5 rounded-3xl border border-warning/40 bg-warning/[0.1] p-5">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-warning text-black">
          <AlertTriangle size={17} aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-[12px] font-bold tracking-[0.12em] text-warning uppercase">Careful</p>
          <p className="mt-0.5 text-[16px] leading-relaxed text-fg">{b.warn}</p>
        </div>
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
      className="group flex w-full items-center gap-4 rounded-3xl border border-transparent p-4 text-left transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-border-strong"
      style={{ backgroundColor: wash(look.hex, 0.12) }}
    >
      <span className="grid size-12 shrink-0 place-items-center rounded-full text-white" style={{ backgroundColor: look.hex }}>
        <Icon size={21} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11.5px] font-bold tracking-[0.12em] uppercase" style={{ color: look.hex }}>
          Who to contact
        </span>
        <span className="block text-[16.5px] font-semibold text-fg">{r.name}</span>
        <span className="block truncate text-[13.5px] text-muted">
          {[r.where, r.email].filter(Boolean).join(' · ') || 'Contact details and official page'}
        </span>
      </span>
      <ArrowUpRight
        size={18}
        className="shrink-0 text-subtle transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-fg"
        aria-hidden
      />
    </button>
  )
}
