import { Link } from 'react-router-dom'
import { ArrowRight, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'

/** The slim, single-line form of a contextual Pro upsell — shown on mobile in
 * place of the full card so the prompt stays visible and tappable without eating
 * vertical space. Icon + short label + a "Pro" tag + arrow; carries the same
 * target (`to`) or action (`onClick`) as the full card it stands in for. The
 * desktop card is kept as-is and the two are swapped purely with `sm:` classes. */
export function UpgradeChip({
  icon: Icon,
  label,
  to,
  onClick,
  className,
}: {
  icon: LucideIcon
  label: string
  to?: string
  onClick?: () => void
  className?: string
}) {
  const cls = cn(
    'group flex w-full items-center gap-2 rounded-lg border border-accent/30 bg-accent-soft px-3 py-2 text-left transition-colors duration-150 hover:border-accent/50',
    className,
  )
  const inner = (
    <>
      <Icon size={15} className="shrink-0 text-accent" aria-hidden />
      <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-fg">{label}</span>
      <span className="shrink-0 rounded bg-accent/15 px-1.5 py-px text-[10px] font-bold tracking-wide text-accent uppercase">
        Pro
      </span>
      <ArrowRight
        size={14}
        className="shrink-0 text-accent transition-transform duration-150 group-hover:translate-x-0.5"
        aria-hidden
      />
    </>
  )
  if (to) {
    return (
      <Link to={to} className={cls}>
        {inner}
      </Link>
    )
  }
  return (
    <button type="button" onClick={onClick} className={cls}>
      {inner}
    </button>
  )
}
