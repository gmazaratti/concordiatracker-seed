import { useSearchParams } from 'react-router-dom'
import { Bug, Lightbulb } from 'lucide-react'
import { RequestsBoard } from './RequestsBoard'
import { BugChannel } from './BugChannel'
import { PinRequestsToast } from './PinRequestsToast'
import { cn } from '@/lib/cn'

const TABS = [
  { id: 'requests', label: 'Feature requests', icon: Lightbulb },
  { id: 'bugs', label: 'Bug reports', icon: Bug },
] as const
type TabId = (typeof TABS)[number]['id']

/** `/app/requests` — the full feedback board rendered INSIDE the student app
 * shell, so the sidebar is always there (reached from the avatar menu and the
 * opt-in pinned item). The standalone /feedback page stays for signed-out /
 * shared links. */
export function AppRequestsPage() {
  const [params, setParams] = useSearchParams()
  const current = (TABS.find((t) => t.id === params.get('tab'))?.id ?? 'requests') as TabId
  const select = (id: TabId) =>
    setParams(
      (p) => {
        p.set('tab', id)
        return p
      },
      { replace: true },
    )

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-6 sm:px-6">
      <header className="mb-4">
        <p className="text-[12px] text-subtle">Around the product</p>
        <h1 className="font-display text-[26px] leading-tight font-medium text-fg">Feedback</h1>
        <p className="mt-1 text-[13px] text-subtle">
          Vote on ideas and suggest what we build next — or report a bug privately.
        </p>
      </header>

      <div role="tablist" aria-label="Feedback channels" className="mb-5 flex gap-1 border-b border-border">
        {TABS.map((t) => {
          const Icon = t.icon
          const active = t.id === current
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => select(t.id)}
              className={cn(
                'inline-flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-[13px] font-medium transition-colors duration-150',
                active ? 'border-accent text-fg' : 'border-transparent text-muted hover:text-fg',
              )}
            >
              <Icon size={15} aria-hidden />
              {t.label}
            </button>
          )
        })}
      </div>

      {current === 'requests' ? <RequestsBoard /> : <BugChannel />}
      {current === 'requests' && <PinRequestsToast />}
    </div>
  )
}
