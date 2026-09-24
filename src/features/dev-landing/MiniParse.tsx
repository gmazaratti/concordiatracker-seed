import { useEffect, useRef, useState } from 'react'
import { FileText } from 'lucide-react'
import { ProvenanceBadge } from '@/components/ProvenanceBadge'
import { KIND_LABEL } from '@/lib/assessment'
import { usePrefersReducedMotion } from '@/app/hooks/usePrefersReducedMotion'
import { COMM221_PARSED } from '@/features/landing/parse-demo-data'
import { useInView } from './useInView'

const STEP_MS = 190

/**
 * The parsed plan for a real outline (COMM 221, the same file the full parse
 * beat reads), cascading in one row at a time once it is on screen. Stands in
 * for the syllabus video until the owner records one.
 */
export function MiniParse() {
  const ref = useRef<HTMLDivElement>(null)
  const seen = useInView(ref)
  const reduced = usePrefersReducedMotion()
  const [count, setCount] = useState(0)
  const total = COMM221_PARSED.length
  const shown = reduced && seen ? total : count

  useEffect(() => {
    if (!seen || reduced || count >= total) return
    const id = window.setTimeout(() => setCount((c) => c + 1), count === 0 ? 350 : STEP_MS)
    return () => window.clearTimeout(id)
  }, [seen, reduced, count, total])

  const weight = COMM221_PARSED.slice(0, shown).reduce((s, i) => s + i.weight, 0)

  return (
    <div ref={ref} className="absolute inset-0 flex flex-col p-4 sm:p-5">
      <div className="flex items-center gap-2.5 border-b border-border pb-3">
        <span className="grid size-8 place-items-center rounded-lg bg-accent-soft text-accent">
          <FileText size={15} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-fg">COMM 221 · Financial Markets</p>
          <p className="text-[11.5px] text-subtle">syllabus.pdf</p>
        </div>
        <span className="shrink-0 rounded-md border border-border px-2 py-1 text-[11px] text-muted tabular-nums">
          {shown}/{total} · {weight}%
        </span>
      </div>
      <ul className="mt-2 flex min-h-0 flex-1 flex-col overflow-hidden">
        {COMM221_PARSED.slice(0, shown).map((item) => (
          <li
            key={item.id}
            className="ct-reveal-item flex items-center gap-3 rounded-lg px-2 py-2 text-[12.5px]"
          >
            <span className="w-14 shrink-0 text-[11px] text-subtle">{KIND_LABEL[item.kind]}</span>
            <span className="min-w-0 flex-1 truncate text-fg">{item.title}</span>
            <span className="hidden shrink-0 text-muted sm:inline">{item.due}</span>
            <span className="w-8 shrink-0 text-right text-muted tabular-nums">{item.weight}%</span>
            <ProvenanceBadge provenance={item.provenance} tone="quiet" className="hidden shrink-0 md:inline-flex" />
          </li>
        ))}
      </ul>
    </div>
  )
}
