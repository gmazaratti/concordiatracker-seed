import { useState } from 'react'
import { SmilePlus } from 'lucide-react'
import { EMOJI_PALETTE, type ReactionSummary } from './feedback-data'
import { cn } from '@/lib/cn'

/** Emoji reaction chips + an "add reaction" picker — the demand signal on each
 * request (replaces the old heart-vote). */
export function ReactionBar({
  reactions,
  canReact,
  onToggle,
}: {
  reactions: ReactionSummary[]
  canReact: boolean
  onToggle: (emoji: string) => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {reactions.map((r) => (
        <button
          key={r.emoji}
          type="button"
          disabled={!canReact}
          onClick={() => onToggle(r.emoji)}
          aria-pressed={r.mine}
          title={canReact ? (r.mine ? 'Remove your reaction' : 'React') : 'Sign in to react'}
          className={cn(
            'inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[13px] transition-colors duration-150 disabled:opacity-60',
            r.mine ? 'border-accent/40 bg-accent-soft' : 'border-border hover:border-border-strong',
          )}
        >
          <span aria-hidden>{r.emoji}</span>
          <span className={cn('text-[12px] font-medium tabular-nums', r.mine ? 'text-accent' : 'text-muted')}>
            {r.count}
          </span>
        </button>
      ))}

      <div className="relative">
        <button
          type="button"
          disabled={!canReact}
          onClick={() => setOpen((o) => !o)}
          title={canReact ? 'Add a reaction' : 'Sign in to react'}
          aria-label="Add a reaction"
          className="inline-flex size-7 items-center justify-center rounded-full border border-border text-subtle transition-colors duration-150 hover:border-border-strong hover:text-fg disabled:opacity-60"
        >
          <SmilePlus size={15} aria-hidden />
        </button>
        {open && (
          <>
            <button className="fixed inset-0 z-40 cursor-default" onClick={() => setOpen(false)} aria-label="Close" tabIndex={-1} />
            <div className="absolute bottom-full left-0 z-50 mb-1.5 flex gap-0.5 rounded-xl border border-border bg-surface p-1.5 shadow-2xl">
              {EMOJI_PALETTE.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => {
                    onToggle(e)
                    setOpen(false)
                  }}
                  className="grid size-8 place-items-center rounded-lg text-[18px] transition-colors duration-150 hover:bg-surface-2"
                >
                  {e}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
