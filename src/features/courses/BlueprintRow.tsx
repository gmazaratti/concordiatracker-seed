import { useState } from 'react'
import { ArrowBigDown, ArrowBigUp, ChevronDown, Download, ShieldCheck } from 'lucide-react'
import { blueprintWeight, netVotes, uploadedOn, type Blueprint } from '@/data/blueprints'
import { term } from '@/data/mock'
import { KIND_LABEL } from '@/lib/assessment'
import { formatFull } from '@/lib/date'
import { cn } from '@/lib/cn'

type Dir = 1 | -1 | 0

/** One blueprint in the ranked list — expandable to preview exactly what gets
 * imported. Credibility signals stay separate: the vote column (popularity) and
 * the meta line (recency + adoption). Community uploads have no ground truth, so
 * NO per-date provenance is shown — votes are their credibility. Teacher-verified
 * dates are official, conveyed by the badge (not repeated per date). Section +
 * term are surfaced up front so you import the right one. */
export function BlueprintRow({
  blueprint,
  yourSection,
  userVote,
  onVote,
  onImport,
  pinned = false,
}: {
  blueprint: Blueprint
  yourSection: string
  userVote: Dir
  onVote: (dir: 1 | -1) => void
  onImport: () => void
  pinned?: boolean
}) {
  const [open, setOpen] = useState(false)
  const net = netVotes(blueprint) + userVote
  const isCurrentTerm = blueprint.term === term.name
  const wrongSection = blueprint.section !== yourSection
  const total = blueprintWeight(blueprint)

  return (
    <div
      className={cn(
        'rounded-xl border bg-surface transition-colors duration-150',
        pinned ? 'border-accent/40 bg-accent-soft/40' : 'border-border',
      )}
    >
      <div className="flex items-stretch gap-3 p-3">
        {/* Popularity — vote column */}
        <div className="flex shrink-0 flex-col items-center justify-center gap-0.5 px-0.5">
          <VoteButton active={userVote === 1} label={`Upvote ${blueprint.author}'s blueprint`} onClick={() => onVote(1)}>
            <ArrowBigUp size={18} />
          </VoteButton>
          <span
            className={cn(
              'min-w-[2ch] text-center text-[13px] font-semibold tabular-nums',
              userVote === 1 ? 'text-accent' : userVote === -1 ? 'text-danger' : 'text-fg',
            )}
          >
            {net}
          </span>
          <VoteButton active={userVote === -1} danger label={`Downvote ${blueprint.author}'s blueprint`} onClick={() => onVote(-1)}>
            <ArrowBigDown size={18} />
          </VoteButton>
        </div>

        {/* Expandable identity + meta */}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="min-w-0 flex-1 py-0.5 text-left"
        >
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-[14px] font-medium text-fg">{blueprint.author}</span>
            {blueprint.teacherVerified && (
              <Badge className="bg-accent/15 text-accent">
                <ShieldCheck size={12} aria-hidden />
                Teacher-verified
              </Badge>
            )}
            <Badge className={wrongSection ? 'bg-warning/15 text-warning' : 'bg-surface-2 text-muted'}>
              Section {blueprint.section}
              {wrongSection && ' · not yours'}
            </Badge>
            <Badge className={isCurrentTerm ? 'bg-surface-2 text-muted' : 'bg-warning/15 text-warning'}>
              {blueprint.term}
              {!isCurrentTerm && ' · past term'}
            </Badge>
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] text-subtle">
            <span>Uploaded {uploadedOn(blueprint.uploadedDaysAgo)}</span>
            <span aria-hidden>·</span>
            <span>{blueprint.dates.length} items</span>
            <span aria-hidden>·</span>
            <span className="inline-flex items-center gap-1">
              <Download size={11} aria-hidden />
              {blueprint.imports} imports
            </span>
          </div>

          <span className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-subtle">
            <ChevronDown
              size={13}
              className={cn('transition-transform duration-150', open && 'rotate-180')}
              aria-hidden
            />
            {open ? 'Hide outline' : 'Preview outline'}
          </span>
        </button>

        {/* Import */}
        <div className="flex shrink-0 items-center">
          <button
            type="button"
            onClick={onImport}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-[13px] font-medium text-accent-contrast shadow-sm transition-colors duration-150 hover:bg-accent-hover"
          >
            <Download size={15} aria-hidden />
            Import
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-border bg-surface-2/30 px-3 py-3">
          <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 px-1 text-[11px] text-subtle">
            <span>Instructor: <span className="text-muted">{blueprint.instructor}</span></span>
            <span>Section {blueprint.section}</span>
            <span>{blueprint.term}</span>
            <span>
              {blueprint.dates.length} items · totals{' '}
              <span className={cn('font-medium', total >= 100 ? 'text-success' : 'text-warning')}>
                {total}%
              </span>
            </span>
          </div>
          <ul className="overflow-hidden rounded-lg border border-border bg-surface">
            {blueprint.dates.map((d, i) => (
              <li
                key={i}
                className="flex items-center gap-2.5 border-b border-border/60 px-3 py-2 text-[12px] last:border-b-0"
              >
                <span className="w-16 shrink-0 rounded bg-surface-2 px-1.5 py-0.5 text-center text-[10px] font-medium text-muted">
                  {KIND_LABEL[d.kind]}
                </span>
                <span className="min-w-0 flex-1 truncate text-fg">{d.title}</span>
                <span className="shrink-0 text-subtle">{formatFull(d.due)}</span>
                <span className="w-9 shrink-0 text-right font-medium text-muted tabular-nums">{d.weight}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function Badge({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold',
        className,
      )}
    >
      {children}
    </span>
  )
}

function VoteButton({
  active,
  danger = false,
  label,
  onClick,
  children,
}: {
  active: boolean
  danger?: boolean
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'grid size-6 place-items-center rounded transition-colors duration-150',
        active
          ? danger
            ? 'text-danger'
            : 'text-accent'
          : 'text-subtle hover:bg-surface-2 hover:text-fg',
      )}
    >
      {children}
    </button>
  )
}
