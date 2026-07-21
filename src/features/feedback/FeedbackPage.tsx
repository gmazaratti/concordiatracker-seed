import { useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Bug, Lightbulb, MessagesSquare, Pin, PinOff } from 'lucide-react'
import { useUiState } from '@/app/providers/ui-state'
import { RequestsBoard } from './RequestsBoard'
import { BugChannel } from './BugChannel'
import { cn } from '@/lib/cn'

const TABS = [
  { id: 'requests', label: 'Feature requests', icon: Lightbulb },
  { id: 'bugs', label: 'Bug reports', icon: Bug },
] as const
type TabId = (typeof TABS)[number]['id']

export function FeedbackPage() {
  const [params, setParams] = useSearchParams()
  const { uiState, loaded, patchUiState } = useUiState()
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const current = (TABS.find((t) => t.id === params.get('tab'))?.id ?? 'requests') as TabId
  const select = (id: TabId) => setParams((p) => { p.set('tab', id); return p }, { replace: true })

  const onKeyDown = (e: React.KeyboardEvent) => {
    const i = TABS.findIndex((t) => t.id === current)
    let next: number
    if (e.key === 'ArrowRight') next = (i + 1) % TABS.length
    else if (e.key === 'ArrowLeft') next = (i - 1 + TABS.length) % TABS.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = TABS.length - 1
    else return
    e.preventDefault()
    select(TABS[next].id)
    refs.current[next]?.focus()
  }

  return (
    <div className="min-h-svh bg-canvas">
      <header className="border-b border-border bg-surface/40">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-5 py-3">
          <span className="flex items-center gap-2 text-[14px] font-medium text-fg">
            <MessagesSquare size={18} className="text-accent" aria-hidden />
            ConcordiaTracker
            <span className="hidden text-subtle sm:inline">· Feedback</span>
          </span>
          <Link
            to="/app"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[12px] font-medium text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
          >
            <ArrowLeft size={14} aria-hidden />
            Back to app
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-5 py-6">
        <h1 className="font-display text-[22px] font-semibold text-fg">Feedback</h1>
        <p className="mt-1 text-[13px] text-subtle">
          Shape what we build next — vote on ideas, or report a bug privately.
        </p>

        <div
          role="tablist"
          aria-label="Feedback channels"
          onKeyDown={onKeyDown}
          className="mt-5 mb-5 flex gap-1 border-b border-border"
        >
          {TABS.map((t, i) => {
            const Icon = t.icon
            const active = t.id === current
            return (
              <button
                key={t.id}
                ref={(el) => { refs.current[i] = el }}
                role="tab"
                id={`fb-tab-${t.id}`}
                aria-selected={active}
                aria-controls={`fb-panel-${t.id}`}
                tabIndex={active ? 0 : -1}
                onClick={() => select(t.id)}
                className={cn(
                  'inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-[13px] font-medium transition-colors duration-150',
                  active ? 'border-accent text-fg' : 'border-transparent text-muted hover:text-fg',
                )}
              >
                <Icon size={15} aria-hidden />
                {t.label}
              </button>
            )
          })}
        </div>

        {/* Opt-in pin: put the requests board one click away in the app sidebar.
            Unpin anytime from the same button. */}
        {current === 'requests' && loaded && (
          <button
            type="button"
            onClick={() => patchUiState({ feedbackPinned: !uiState.feedbackPinned })}
            className={cn(
              'mb-4 inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] font-medium transition-colors duration-150',
              uiState.feedbackPinned
                ? 'border-border text-muted hover:bg-surface-2 hover:text-fg'
                : 'border-accent/50 bg-accent-soft/40 text-fg hover:bg-accent-soft',
            )}
          >
            {uiState.feedbackPinned ? (
              <>
                <PinOff size={13} aria-hidden />
                Unpin from sidebar
              </>
            ) : (
              <>
                <Pin size={13} aria-hidden />
                Pin to my sidebar
              </>
            )}
          </button>
        )}

        <div role="tabpanel" id={`fb-panel-${current}`} aria-labelledby={`fb-tab-${current}`}>
          {current === 'requests' ? <RequestsBoard /> : <BugChannel />}
        </div>
      </main>
    </div>
  )
}
