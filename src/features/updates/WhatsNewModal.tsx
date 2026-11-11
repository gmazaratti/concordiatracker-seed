import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, Lightbulb } from 'lucide-react'
import { useUpdates } from '@/app/providers/updates'
import { RELEASES } from '@/data/releases'
import { ModalShell } from '@/command/ModalShell'
import { ReleaseCard, ReleaseRow } from './ReleaseCard'
import { ReleaseDetail } from './ReleaseDetail'

/** How many of the older releases show before "Show older updates". */
const FIRST_PAGE = 6

/**
 * The version history, as a wall of cards rather than one long list: the
 * latest release large, the two before it beside it, the rest in a grid. A
 * card opens that release's notes in place. Opening the history (via the
 * provider) marks the latest release seen.
 */
export function WhatsNewModal() {
  const { closeHistory } = useUpdates()
  const [open, setOpen] = useState<number | null>(null)
  const [all, setAll] = useState(false)
  const scroller = useRef<HTMLDivElement>(null)

  /** Both views share one scroller, so each starts from its top. */
  function show(index: number | null) {
    setOpen(index)
    if (scroller.current) scroller.current.scrollTop = 0
  }

  const [lead, ...rest] = RELEASES
  const side = rest.slice(0, 2)
  const older = rest.slice(2)
  const shown = all ? older : older.slice(0, FIRST_PAGE)

  return (
    <ModalShell label="What's new" onClose={closeHistory} widthClass="sm:max-w-5xl" scroll={false}>
      {/* Pinned header and footer, only the middle scrolls: the scrollbar never
          reaches the rounded corners. */}
      <div className="flex max-h-[88vh] flex-col">
        <div className="shrink-0 border-b border-border px-5 pt-6 pb-4 pr-14 sm:px-6">
          <h2 className="font-display text-[26px] leading-tight font-bold tracking-tight text-fg">News and updates</h2>
          <p className="mt-1 text-[13.5px] leading-relaxed text-muted">
            What we have shipped, newest first. Open one to read what changed.
          </p>
        </div>

        <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto">
          {open !== null && RELEASES[open] ? (
            <ReleaseDetail key={open} release={RELEASES[open]} index={open} onBack={() => show(null)} />
          ) : (
            <div className="space-y-3 px-4 py-4 sm:px-6 sm:py-5">
              <div className="grid gap-3 lg:grid-cols-[1.15fr_1fr]">
                {lead && <ReleaseCard release={lead} index={0} lead onOpen={() => show(0)} />}
                <div className="grid gap-3 lg:grid-rows-2">
                  {side.map((r, i) => (
                    <ReleaseRow key={r.version} release={r} index={i + 1} onOpen={() => show(i + 1)} />
                  ))}
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {shown.map((r, i) => (
                  <ReleaseCard key={r.version} release={r} index={i + 3} onOpen={() => show(i + 3)} />
                ))}
              </div>
              {!all && older.length > FIRST_PAGE && (
                <div className="flex justify-center pt-2">
                  <button
                    type="button"
                    onClick={() => setAll(true)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2.5 text-[13.5px] font-medium text-fg transition-colors duration-150 hover:border-border-strong hover:bg-surface-2"
                  >
                    Show {older.length - FIRST_PAGE} older updates
                    <ChevronDown size={15} aria-hidden />
                  </button>
                </div>
              )}
              <p className="pt-1 text-center text-[11.5px] text-subtle">
                Cover photos of the campuses are from Wikimedia Commons. Credits are at the foot of Planner, Resources.
              </p>
            </div>
          )}
        </div>

        {/* Cross-link to the requests board (the listen, build, proof loop). */}
        <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-t border-border bg-surface-2/40 px-5 py-3.5 pb-[calc(0.875rem+env(safe-area-inset-bottom))] sm:px-6 sm:pb-3.5">
          <Link
            to="/app/requests?tab=requests"
            onClick={closeHistory}
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-accent hover:underline"
          >
            <Lightbulb size={14} aria-hidden />
            Got an idea? Request a feature &rarr;
          </Link>
          <p className="text-[12px] text-subtle">Many of these shipped from community requests.</p>
        </div>
      </div>
    </ModalShell>
  )
}
